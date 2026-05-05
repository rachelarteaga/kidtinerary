import "./deck.css";

export default function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="deck-root">{children}</div>;
}
