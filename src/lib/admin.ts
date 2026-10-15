import { englishApiError } from "./errors";
import { supabase } from "./supabase";
import type { BookSnapshot, InventoryItem, Loan, Reservation } from "../types";
export interface AdminBook extends InventoryItem {
  title: string | null;
  author: string | null;
  cover_id: number | null;
  retired: boolean;
}
export interface AdminDashboard {
  books: AdminBook[];
  loans: (Loan & { email: string })[];
  reservations: (Reservation & { email: string })[];
}
const client = () => {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
};
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await client().rpc("is_library_admin");
  if (error) throw new Error(englishApiError(error.message));
  return data === true;
}
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data, error } = await client().rpc("admin_dashboard");
  if (error) throw new Error(englishApiError(error.message));
  return data as AdminDashboard;
}
export async function saveAdminBook(
  book: BookSnapshot,
  total: number,
  retired = false,
): Promise<void> {
  const { error } = await client().rpc("admin_save_book", {
    p_work_id: book.work_id,
    p_title: book.title,
    p_author: book.author,
    p_cover_id: book.cover_id,
    p_total_copies: total,
    p_retired: retired,
  });
  if (error) throw new Error(englishApiError(error.message));
}
