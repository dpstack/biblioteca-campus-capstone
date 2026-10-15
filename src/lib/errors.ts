// Existing database installations may return the original Spanish RPC messages.
// Keep their business rules intact while presenting English errors to the user.
const messages: Record<string, string> = {
  "Debes iniciar sesión.": "You must sign in.",
  "Datos del libro inválidos.": "Invalid book data.",
  "Este libro no pertenece a la colección.":
    "This book does not belong to the collection.",
  "Ya tienes un préstamo activo de esta obra.":
    "You already have an active loan for this work.",
  "No hay ejemplares disponibles; puedes reservarlo.":
    "No copies are available. You can reserve this book.",
  "El próximo ejemplar está reservado para otra persona.":
    "The next copy is reserved for another reader.",
  "Hay ejemplares disponibles; solicita un préstamo.":
    "Copies are available. Please request a loan.",
  "Ya tienes esta obra en préstamo.": "You already have this work on loan.",
  "Ya reservaste esta obra.": "You have already reserved this work.",
  "Préstamo no encontrado.": "Loan not found.",
  "Este préstamo ya fue devuelto.": "This loan has already been returned.",
  "Reserva pendiente no encontrada.": "Pending reservation not found.",
  "Acceso exclusivo para administradores.": "Administrator access required.",
  "Datos del inventario inválidos.": "Invalid inventory data.",
  "Resuelve las reservas pendientes antes de retirar la obra.":
    "Resolve pending reservations before retiring this work.",
  "Esta obra está retirada de nuevos préstamos y reservas.":
    "This work is closed to new loans and reservations.",
};

export function englishApiError(message: string): string {
  const active = message.match(
    /^No puedes reducir ejemplares por debajo de los préstamos activos \((\d+)\)\.$/,
  );
  if (active)
    return `Total copies cannot be lower than active loans (${active[1]}).`;
  return messages[message] ?? message;
}
