import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingControl } from "../../src/components/ReadingControl";
import {
  getReadingStatus,
  setReadingStatus,
  removeReadingItem,
} from "../../src/lib/library";
jest.mock("../../src/lib/library", () => ({
  getReadingStatus: jest.fn(),
  setReadingStatus: jest.fn(),
  removeReadingItem: jest.fn(),
}));
const book = {
  work_id: "OL1W",
  title: "Campus",
  author: "Ana",
  cover_id: null,
};
beforeEach(() => {
  (getReadingStatus as jest.Mock).mockResolvedValue("reading");
  (setReadingStatus as jest.Mock).mockResolvedValue(undefined);
  (removeReadingItem as jest.Mock).mockResolvedValue(undefined);
});
test("restaura el estado y conserva un cambio después de volver a abrir", async () => {
  const user = userEvent.setup();
  const first = render(<ReadingControl book={book} />);
  const selector = screen.getByLabelText("Estado en mi lista de lectura");
  await waitFor(() => expect(selector).toHaveValue("reading"));
  await user.selectOptions(selector, "finished");
  await screen.findByText("Tu estado de lectura se guardó.");
  expect(setReadingStatus).toHaveBeenCalledWith(book, "finished");
  first.unmount();
  (getReadingStatus as jest.Mock).mockResolvedValue("finished");
  render(<ReadingControl book={book} />);
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveValue("finished"),
  );
});
test("un guardado fallido conserva el estado y permite recuperarlo", async () => {
  (setReadingStatus as jest.Mock).mockRejectedValue(new Error("Offline"));
  const user = userEvent.setup();
  render(<ReadingControl book={book} />);
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveValue("reading"),
  );
  await user.selectOptions(screen.getByRole("combobox"), "finished");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Tu estado anterior se conserva",
  );
  expect(screen.getByRole("combobox")).toHaveValue("reading");
  await user.click(screen.getByRole("button", { name: "Volver a cargar" }));
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
});
test("elimina una lectura y vuelve al estado sin selección", async () => {
  const user = userEvent.setup();
  render(<ReadingControl book={book} />);
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveValue("reading"),
  );
  await user.click(screen.getByRole("button", { name: "Quitar de mi lista" }));
  expect(
    await screen.findByText("Libro eliminado de tu lista."),
  ).toBeInTheDocument();
  expect(removeReadingItem).toHaveBeenCalledWith("OL1W");
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(
    screen.queryByRole("button", { name: "Quitar de mi lista" }),
  ).not.toBeInTheDocument();
});
test("un error al cargar no permite sobrescribir una lectura desconocida", async () => {
  (getReadingStatus as jest.Mock).mockRejectedValue(new Error("Offline"));
  render(<ReadingControl book={book} />);
  await screen.findByRole("alert");
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(setReadingStatus).not.toHaveBeenCalled();
});
