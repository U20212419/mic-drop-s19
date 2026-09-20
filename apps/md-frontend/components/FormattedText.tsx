import TenorEmbed from "./TenorEmbed";

export default function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      const isDirectGif = part.match(/\.gif(\?.*)?$/i);
      const giphyMatch = part.match(/giphy\.com\/(?:gifs|embed)\/(?:.*-)?([a-zA-Z0-9]+)/i);
      const tenorMatch = part.match(/tenor\.com\/view\/.*-(\d+)/i);

      // If it's a GIF, we only render the embed (image/component) and omit the link text
      if (isDirectGif || giphyMatch || tenorMatch) {
        return (
          <span key={i} className="block mt-1 mb-2">
            {isDirectGif && (
              <img
                src={part}
                alt="Embedded GIF"
                className="max-w-full max-h-64 rounded-md object-contain bg-[#2B2D31]"
                loading="lazy"
              />
            )}

            {/* Giphy */}
            {giphyMatch && (
              <img
                src={`https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`}
                alt="Giphy GIF"
                className="max-w-full max-h-64 rounded-md object-contain bg-[#2B2D31]"
                loading="lazy"
              />
            )}

            {/* Tenor - using the TenorEmbed component */}
            {tenorMatch && <TenorEmbed tenorId={tenorMatch[1]} />}
          </span>
        );
      }

      // If it's not a GIF, we show the normal link
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5865F2] hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
