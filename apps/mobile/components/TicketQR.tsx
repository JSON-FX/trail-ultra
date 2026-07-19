import QRCode from "react-native-qrcode-svg";

export function TicketQR({ value, size = 220 }: { value: string; size?: number }) {
  return <QRCode value={value} size={size} backgroundColor="#ffffff" color="#000000" />;
}
