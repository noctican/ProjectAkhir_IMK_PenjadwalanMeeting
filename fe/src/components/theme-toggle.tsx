import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "temuyuk-theme";

function currentTheme(): Theme {
	if (typeof document === "undefined") return "light";
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("light");

	useEffect(() => {
		setTheme(currentTheme());
	}, []);

	function toggle() {
		const next: Theme = currentTheme() === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// localStorage can be blocked; the theme still applies for this session.
		}
		setTheme(next);
	}

	const dark = theme === "dark";

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={dark ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
			title={dark ? "Tema terang" : "Tema gelap"}
			className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:bg-subtle hover:text-ink"
		>
			{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
		</button>
	);
}
