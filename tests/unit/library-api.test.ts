/** @jest-environment node */
import { supabase } from "../../src/lib/supabase";
import {
  borrowBook,
  reserveBook,
  returnBook,
  cancelReservation,
  getReadingStatus,
  setReadingStatus,
  removeReadingItem,
} from "../../src/lib/library";
jest.mock("../../src/lib/supabase", () => {
  const { createClient } = require("@supabase/supabase-js");
  return {
    supabase: createClient("https://test.supabase.co", "publishable-test", {
      global: { fetch: (...args) => global.fetch(...args) },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  };
});
const book = {
  work_id: "OL1W",
  title: "Campus",
  author: "Ana",
  cover_id: null,
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(async () => {
  global.fetch = jest.fn(async (input) =>
    String(input).includes("/auth/v1/token")
      ? response({
          access_token: "test-token",
          refresh_token: "refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "student" },
        })
      : response({ id: "student" }),
  );
  await supabase!.auth.signInWithPassword({
    email: "test@example.invalid",
    password: "test-password",
  });
  (fetch as jest.Mock).mockClear();
});
test("las operaciones protegidas envían el JWT al endpoint RPC real del SDK", async () => {
  (fetch as jest.Mock).mockImplementation(async () => response("id"));
  await borrowBook(book);
  await reserveBook(book);
  await returnBook("loan-1");
  await cancelReservation("reservation-1");
  const calls = (fetch as jest.Mock).mock.calls;
  expect(calls.map(([url]) => new URL(url).pathname)).toEqual([
    "/rest/v1/rpc/borrow_book",
    "/rest/v1/rpc/reserve_book",
    "/rest/v1/rpc/return_book",
    "/rest/v1/rpc/cancel_reservation",
  ]);
  calls.forEach(([, options]) => {
    expect(options.method).toBe("POST");
    expect(new Headers(options.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
  });
  expect(JSON.parse(calls[0][1].body)).toMatchObject({ p_work_id: "OL1W" });
});
test("un rechazo del servidor se propaga hasta la interfaz", async () => {
  (fetch as jest.Mock).mockResolvedValue(
    response({ message: "No hay ejemplares disponibles", code: "P0001" }, 400),
  );
  await expect(borrowBook(book)).rejects.toThrow(
    "No hay ejemplares disponibles",
  );
});
test("lectura y eliminación se limitan a la obra y conservan Authorization", async () => {
  (fetch as jest.Mock).mockResolvedValue(response({ status: "reading" }));
  expect(await getReadingStatus("OL1W")).toBe("reading");
  (fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 204 }));
  await removeReadingItem("OL1W");
  const calls = (fetch as jest.Mock).mock.calls;
  expect(new URL(calls[0][0]).searchParams.get("work_id")).toBe("eq.OL1W");
  expect(new URL(calls[1][0]).searchParams.get("work_id")).toBe("eq.OL1W");
  expect(calls[1][1].method).toBe("DELETE");
  expect(new Headers(calls[1][1].headers).get("Authorization")).toBe(
    "Bearer test-token",
  );
});
test("guardar lectura obtiene la identidad autenticada y usa su propietario", async () => {
  (fetch as jest.Mock).mockImplementation(async (input) =>
    String(input).includes("/auth/v1/user")
      ? response({ id: "student" })
      : new Response(null, { status: 201 }),
  );
  await setReadingStatus(book, "finished");
  const write = (fetch as jest.Mock).mock.calls.find(([url]) =>
    String(url).includes("/rest/v1/reading_list"),
  );
  expect(JSON.parse(write[1].body)).toMatchObject({
    work_id: "OL1W",
    user_id: "student",
    status: "finished",
  });
});
