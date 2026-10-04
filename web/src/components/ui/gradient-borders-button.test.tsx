import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Link } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import GradientBordersButton from "./gradient-borders-button";

describe("GradientBordersButton", () => {
  it("does not submit a surrounding form unless explicitly requested", () => {
    const submit = vi.fn(event => event.preventDefault());
    const { rerender } = render(<form onSubmit={submit}><GradientBordersButton /></form>);
    fireEvent.click(screen.getByRole("button", { name: "Gradient Borders" }));
    expect(submit).not.toHaveBeenCalled();
    rerender(<form onSubmit={submit}><GradientBordersButton type="submit">Continue</GradientBordersButton></form>);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("keeps disabled controls inactive", () => {
    const click = vi.fn();
    render(<GradientBordersButton disabled onClick={click}>Continue</GradientBordersButton>);
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });

  it("renders a single real guide link when used asChild", () => {
    const { container } = render(
      <MemoryRouter>
        <GradientBordersButton asChild className="home-cta">
          <Link to="/guide">Start here</Link>
        </GradientBordersButton>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Start here" });
    expect(link).toHaveAttribute("href", "/guide");
    expect(link).not.toHaveAttribute("type");
    expect(link).toHaveClass("gradient-borders-button", "home-cta");
    expect(container.querySelector("button, a a")).not.toBeInTheDocument();
  });
});
