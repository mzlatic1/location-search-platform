import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
export const metadata = {
  title: 'Atlas / Location Discovery',
  description: 'Transparent, location-aware place search',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
