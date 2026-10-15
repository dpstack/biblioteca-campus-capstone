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
test("restores the reading status and preserves a change after reopening", async () => {
  const user = userEvent.setup();
  const first = render(<ReadingControl book={book} />);
  const selector = screen.getByLabelText("My reading status");
  await waitFor(() => expect(selector).toHaveValue("reading"));
  await user.selectOptions(selector, "finished");
  await screen.findByText("Your reading status was saved.");
  expect(setReadingStatus).toHaveBeenCalledWith(book, "finished");
  first.unmount();
  (getReadingStatus as jest.Mock).mockResolvedValue("finished");
  render(<ReadingControl book={book} />);
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveValue("finished"),
  );
});
test("a failed save preserves the previous status and allows recovery", async () => {
  (setReadingStatus as jest.Mock).mockRejectedValue(new Error("Offline"));
  const user = userEvent.setup();
  render(<ReadingControl book={book} />);
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveValue("reading"),
  );
  await user.selectOptions(screen.getByRole("combobox"), "finished");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your previous status has been kept",
  );
  expect(screen.getByRole("combobox")).toHaveValue("reading");
  await user.click(screen.getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
});
test("removes a reading item and clears the selection", async () => {
  const user = userEvent.setup();
  render(<ReadingControl book={book} />);
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveValue("reading"),
  );
  await user.click(screen.getByRole("button", { name: "Remove from my list" }));
  expect(
    await screen.findByText("Book removed from your list."),
  ).toBeInTheDocument();
  expect(removeReadingItem).toHaveBeenCalledWith("OL1W");
  expect(screen.getByRole("combobox")).toHaveValue("");
  expect(
    screen.queryByRole("button", { name: "Remove from my list" }),
  ).not.toBeInTheDocument();
});
test("a load error prevents overwriting an unknown reading status", async () => {
  (getReadingStatus as jest.Mock).mockRejectedValue(new Error("Offline"));
  render(<ReadingControl book={book} />);
  await screen.findByRole("alert");
  expect(screen.getByRole("combobox")).toBeDisabled();
  expect(setReadingStatus).not.toHaveBeenCalled();
});
