import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressionControls } from "./ProgressionControls";

describe("progression controls", () => {
  it("shows the selected level's baseline and keeps earned rewards explicit", () => {
    const onLevel = vi.fn();
    render(<ProgressionControls level="30" levelCap={45} onLevel={onLevel}
      earned={{ skill: 0, stigma: 0, daevanion: 0 }} onEarned={vi.fn()}
      stigmaUnlocked={false} onStigmaUnlocked={vi.fn()}
      daevanionUnlocked={false} onDaevanionUnlocked={vi.fn()} />);
    expect(screen.getByText("111")).toBeInTheDocument();
    expect(screen.getByText("76")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Stigma unlock/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Daevanion unlock/ })).not.toBeChecked();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "22" } });
    expect(onLevel).toHaveBeenCalledWith("22");
    fireEvent.click(screen.getByText("Earned rewards"));
    expect(screen.getByLabelText("Extra skill points")).toHaveValue(0);
  });
});
