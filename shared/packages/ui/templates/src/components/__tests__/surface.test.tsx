import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Surface } from "@/components/surface";

describe("Surface", () => {
  test("renders its children", () => {
    render(<Surface>hello</Surface>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  test("forwards a caller-supplied className", () => {
    render(<Surface className="rounded-lg border">content</Surface>);
    expect(screen.getByText("content")).toHaveClass("rounded-lg", "border");
  });

  test("forwards other div props, like a test id", () => {
    render(<Surface data-testid="panel">content</Surface>);
    expect(screen.getByTestId("panel")).toBeInTheDocument();
  });
});
