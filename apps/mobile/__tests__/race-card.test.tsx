import { render, screen, fireEvent } from "@testing-library/react-native";
import { RaceCard } from "../components/RaceCard";

describe("RaceCard", () => {
  it("shows org name, title, meta and a status badge", () => {
    render(<RaceCard variant="registered" title="Kalatungan Skyrun" meta="21K · Oct 18" orgName="Race Pace" />);
    expect(screen.getByText("Race Pace")).toBeOnTheScreen();
    expect(screen.getByText("Kalatungan Skyrun")).toBeOnTheScreen();
    expect(screen.getByText("21K · Oct 18")).toBeOnTheScreen();
    expect(screen.getByText("Registered")).toBeOnTheScreen();
  });

  it("fires onPress when the card body is tapped", () => {
    const onPress = jest.fn();
    render(<RaceCard variant="completed" title="Mt. Apo Sky Race" onPress={onPress} />);
    expect(screen.getByText("Completed")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Mt. Apo Sky Race"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders pay and cancel actions only for the unpaid variant", () => {
    const onPay = jest.fn();
    const onCancel = jest.fn();
    render(<RaceCard variant="unpaid" title="Sierra Madre Challenge" onPay={onPay} onCancel={onCancel} />);
    expect(screen.getByText("Unpaid")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Complete payment"));
    fireEvent.press(screen.getByText("Cancel"));
    expect(onPay).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows a Refunded badge and no pay/cancel actions for the refunded variant", () => {
    render(<RaceCard variant="refunded" title="Cordillera Run" />);
    expect(screen.getByText("Refunded")).toBeOnTheScreen();
    expect(screen.queryByText("Complete payment")).toBeNull();
    expect(screen.queryByText("Cancel")).toBeNull();
  });
});
