import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import SendSignals from "../radar/src/pages/SendSignals";

vi.mock("../radar/src/lib/api", () => ({
  scans: { scan: vi.fn() },
  signals: { ingest: vi.fn() },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter><SendSignals /></BrowserRouter>
    </QueryClientProvider>
  );
}

describe("SendSignals page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders page title", () => {
    renderPage();
    expect(screen.getByText("Send Signals")).toBeInTheDocument();
  });

  it("shows URL Scan mode by default", () => {
    renderPage();
    expect(screen.getByPlaceholderText("https://example.com")).toBeInTheDocument();
  });

  it("has mode tabs for URL Scan and Manual Entry", () => {
    renderPage();
    expect(screen.getByText("URL Scan")).toBeInTheDocument();
    expect(screen.getByText("Manual Entry")).toBeInTheDocument();
  });

  it("switches to Manual Entry mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Manual Entry"));
    expect(screen.getByText("Manual Signal Entry")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("example.com")).toBeInTheDocument();
  });

  it("has source dropdown in manual mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Manual Entry"));
    const sourceSelect = screen.getByDisplayValue("Station Alpha (Web)");
    expect(sourceSelect).toBeInTheDocument();
  });

  it("disables submit when domain is empty in manual mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Manual Entry"));
    expect(screen.getByRole("button", { name: "Submit Signal" })).toBeDisabled();
  });
});
