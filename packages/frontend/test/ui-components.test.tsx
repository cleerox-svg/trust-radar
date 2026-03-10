import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "../radar/src/components/ui/Badge";
import { Button } from "../radar/src/components/ui/Button";
import { ScoreRing } from "../radar/src/components/ui/ScoreRing";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>critical</Badge>);
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    const { container } = render(<Badge variant="high">HIGH</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("threat-high");
  });

  it("applies custom className", () => {
    const { container } = render(<Badge className="custom-class">test</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("custom-class");
  });
});

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Go</Button>);
    await user.click(screen.getByRole("button"));
    expect(clicked).toBe(true);
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies size variant", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-8");
  });

  it("applies destructive variant", () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("threat-critical");
  });
});

describe("ScoreRing", () => {
  it("renders an SVG", () => {
    const { container } = render(<ScoreRing score={75} animated={false} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays the score number", () => {
    render(<ScoreRing score={85} animated={false} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("shows health label for md size", () => {
    render(<ScoreRing score={95} size="md" animated={false} />);
    expect(screen.getByText("Exceptional")).toBeInTheDocument();
  });

  it("shows Protected for score 75", () => {
    render(<ScoreRing score={75} size="lg" animated={false} />);
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });

  it("shows Critical for score 20", () => {
    render(<ScoreRing score={20} size="lg" animated={false} />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("does not show label for sm size", () => {
    render(<ScoreRing score={50} size="sm" animated={false} />);
    expect(screen.queryByText("Attention")).not.toBeInTheDocument();
  });
});
