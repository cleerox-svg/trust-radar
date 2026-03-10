import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import Home from "../radar/src/pages/Home";

// Mock the api module
vi.mock("../radar/src/lib/api", () => ({
  scans: {
    scan: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the hero heading", () => {
    renderWithProviders(<Home />);
    expect(screen.getByText(/Is this URL/)).toBeInTheDocument();
    expect(screen.getByText("safe?")).toBeInTheDocument();
  });

  it("renders the scanner input", () => {
    renderWithProviders(<Home />);
    expect(screen.getByPlaceholderText(/example.com/)).toBeInTheDocument();
  });

  it("disables button when input is empty", () => {
    renderWithProviders(<Home />);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("enables button when URL is entered", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);
    const input = screen.getByPlaceholderText(/example.com/);
    await user.type(input, "https://test.com");
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("shows empty state cards when no result", () => {
    renderWithProviders(<Home />);
    expect(screen.getByText("SSL Check")).toBeInTheDocument();
    expect(screen.getByText("WHOIS Data")).toBeInTheDocument();
    expect(screen.getByText("VirusTotal")).toBeInTheDocument();
  });

  it("renders real-time threat intelligence badge", () => {
    renderWithProviders(<Home />);
    expect(screen.getByText("Real-time threat intelligence")).toBeInTheDocument();
  });
});
