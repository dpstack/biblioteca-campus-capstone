import { englishApiError } from "./errors";
import { supabase } from "./supabase";
import type {
  BookSnapshot,
  InventoryItem,
  Loan,
  ReadingListItem,
  ReadingStatus,
  Reservation,
} from "../types";

const client = () => {
  if (!supabase)
    throw new Error("Connect a Supabase project to use this feature.");
  return supabase;
};

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(englishApiError(error.message));
};

export async function getInventory(
  workIds: string[],
): Promise<InventoryItem[]> {
  if (!supabase || workIds.length === 0) return [];
  const { data, error } = await supabase
    .from("library_books")
    .select("work_id,total_copies,available_copies,retired")
    .in("work_id", workIds);
  throwIfError(error);
  return (data ?? []) as InventoryItem[];
}

export async function getAvailableInventory(
  signal?: AbortSignal,
): Promise<InventoryItem[]> {
  const stock: InventoryItem[] = [];
  // Read every range: PostgREST caps individual responses, not the collection.
  for (let offset = 0; ; offset += 500) {
    const query = client()
      .from("library_books")
      .select("work_id,total_copies,available_copies,retired")
      .eq("retired", false)
      .gt("available_copies", 0)
      .order("work_id")
      .range(offset, offset + 499);
    const { data, error } = await (signal ? query.abortSignal(signal) : query);
    throwIfError(error);
    const batch = (data ?? []) as InventoryItem[];
    stock.push(...batch);
    if (batch.length < 500) return stock;
  }
}

export async function getMyLoans(): Promise<Loan[]> {
  const { data, error } = await client()
    .from("loans")
    .select("id,work_id,title,author,cover_id,borrowed_at,due_at,returned_at")
    .order("borrowed_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Loan[];
}

export async function getMyReservations(): Promise<Reservation[]> {
  const { data, error } = await client()
    .from("reservations")
    .select("id,work_id,title,author,cover_id,created_at,status")
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as Reservation[];
}

export async function getMyReadingList(): Promise<ReadingListItem[]> {
  const { data, error } = await client()
    .from("reading_list")
    .select("work_id,title,author,cover_id,status,updated_at")
    .order("updated_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as ReadingListItem[];
}

export async function getReadingStatus(
  workId: string,
): Promise<ReadingStatus | null> {
  const { data, error } = await client()
    .from("reading_list")
    .select("status")
    .eq("work_id", workId)
    .maybeSingle();
  throwIfError(error);
  return data?.status ?? null;
}

export async function removeReadingItem(workId: string): Promise<void> {
  const { error } = await client()
    .from("reading_list")
    .delete()
    .eq("work_id", workId);
  throwIfError(error);
}

export async function setReadingStatus(
  book: BookSnapshot,
  status: ReadingStatus,
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await client().auth.getUser();
  throwIfError(authError);
  if (!user) throw new Error("Sign in to save your reading list.");
  const { error } = await client()
    .from("reading_list")
    .upsert(
      {
        ...book,
        user_id: user.id,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,work_id" },
    );
  throwIfError(error);
}

export async function borrowBook(book: BookSnapshot): Promise<void> {
  const { error } = await client().rpc("borrow_book", {
    p_work_id: book.work_id,
    p_title: book.title,
    p_author: book.author,
    p_cover_id: book.cover_id,
  });
  throwIfError(error);
}

export async function reserveBook(book: BookSnapshot): Promise<void> {
  const { error } = await client().rpc("reserve_book", {
    p_work_id: book.work_id,
    p_title: book.title,
    p_author: book.author,
    p_cover_id: book.cover_id,
  });
  throwIfError(error);
}

export async function returnBook(loanId: string): Promise<void> {
  const { error } = await client().rpc("return_book", { p_loan_id: loanId });
  throwIfError(error);
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const { error } = await client().rpc("cancel_reservation", {
    p_reservation_id: reservationId,
  });
  throwIfError(error);
}
