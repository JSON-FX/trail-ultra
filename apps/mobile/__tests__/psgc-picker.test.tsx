import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

let regions: any[] = [{ code: "r1", name: "Davao Region" }];
let provinces: any[] = [{ code: "p1", name: "Davao del Sur" }];
let cities: any[] = [{ code: "c1", name: "Digos City" }, { code: "c2", name: "Bansalan" }];
jest.mock("../lib/psgc", () => ({
  usePsgcRegions: () => ({ data: regions }),
  usePsgcProvinces: () => ({ data: provinces }),
  usePsgcCities: () => ({ data: cities }),
}));

import { PsgcAddressPicker } from "../components/PsgcAddressPicker";

describe("PsgcAddressPicker", () => {
  it("cascades region → province → city and emits the address", async () => {
    const onChange = jest.fn();
    render(<PsgcAddressPicker value={null} onChange={onChange} label="LOCATION" />);
    fireEvent.press(screen.getByLabelText("LOCATION"));                 // open
    fireEvent.press(screen.getByText("Davao Region"));                  // region
    fireEvent.press(await screen.findByText("Davao del Sur"));          // province
    fireEvent.press(await screen.findByText("Digos City"));             // city
    expect(onChange).toHaveBeenCalledWith({
      city_psgc_code: "c1", city_name: "Digos City", province_name: "Davao del Sur", region_name: "Davao Region",
    });
  });

  it("shows the current value via formatAddress", () => {
    render(<PsgcAddressPicker label="LOCATION" onChange={jest.fn()}
      value={{ city_psgc_code: "c1", city_name: "Digos City", province_name: "Davao del Sur", region_name: "Davao Region" }} />);
    expect(screen.getByText("Digos City, Davao del Sur")).toBeOnTheScreen();
  });
});
