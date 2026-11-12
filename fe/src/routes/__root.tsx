import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAppStore } from "@/data/store";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "title", content: "TemuYuk — Cari waktu yang pas" },
			{
				name: "description",
				content:
					"TemuYuk membantu pengurus organisasi menemukan waktu rapat yang cocok untuk semua peserta.",
			},
			{ name: "theme-color", content: "#f5f2f7" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="id">
			<head>
				<script>
					{'(function(){try{var t=localStorage.getItem("temuyuk-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();'}
				</script>
				<HeadContent />
			</head>
			<body>
				<AppBootstrap />
				{children}
				<Scripts />
			</body>
		</html>
	);
}

/** Menentukan mode data (server atau demo lokal) sekali untuk seluruh aplikasi. */
function AppBootstrap() {
	const bootstrap = useAppStore((s) => s.bootstrap);
	useEffect(() => {
		void bootstrap();
	}, [bootstrap]);
	return null;
}
