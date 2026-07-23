import { render, screen } from "@testing-library/react-native";
import { OrgAvatar } from "../components/OrgAvatar";
import { OrgBanner } from "../components/OrgBanner";

describe("OrgAvatar", () => {
  it("shows initials as the fallback with no logo", () => {
    render(<OrgAvatar name="Muspo Trail" color="#159A55" size={48} />);
    expect(screen.getByText("MT")).toBeOnTheScreen();
  });
  it("still renders (with the initials fallback) when a logo URL is provided", () => {
    render(<OrgAvatar name="Muspo Trail" logoUrl="https://cdn/x.png" size={48} />);
    expect(screen.getByText("MT")).toBeOnTheScreen();
  });
});

describe("OrgBanner", () => {
  it("renders the cover image when bannerUrl is set", () => {
    render(<OrgBanner height={170} bannerUrl="https://cdn/b.png" />);
    expect(screen.getByLabelText("Organization cover photo")).toBeOnTheScreen();
  });
  it("renders the fallback (no cover image) when bannerUrl is absent", () => {
    render(<OrgBanner height={170} />);
    expect(screen.queryByLabelText("Organization cover photo")).toBeNull();
  });
});
