import { useEffect } from "react";

export default function TenorEmbed({ tenorId }: { tenorId: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = `https://tenor.com/embed.js?v=${Date.now()}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [tenorId]);

  return (
    <div className="w-full max-w-87.5 mt-2 rounded-md overflow-hidden bg-[#2B2D31]">
      <div
        className="tenor-gif-embed"
        data-postid={tenorId}
        data-share-method="host"
        data-width="100%"
      />
    </div>
  );
}
