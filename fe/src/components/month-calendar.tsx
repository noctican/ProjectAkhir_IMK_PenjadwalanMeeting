export type DateMode = "range" | "custom";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function monthStart(month: string): Date {
	const [year, value] = month.split("-").map(Number);
	return new Date(Date.UTC(year, (value ?? 1) - 1, 1));
}

function shiftMonth(month: string, amount: number): string {
	const date = monthStart(month);
	date.setUTCMonth(date.getUTCMonth() + amount);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function MonthCalendar({
	month,
	onMonthChange,
	mode,
	selected,
	rangeStart,
	rangeEnd,
	min,
	onRangeClick,
	onToggle,
}: {
	month: string;
	onMonthChange: (month: string) => void;
	mode: DateMode;
	selected: string[];
	rangeStart: string;
	rangeEnd: string;
	min: string;
	onRangeClick: (date: string) => void;
	onToggle: (date: string) => void;
}) {
	const first = monthStart(month);
	const offset = (first.getUTCDay() + 6) % 7;
	const cells: Array<{ date: string; inMonth: boolean }> = [];
	for (let index = 0; index < 42; index += 1) {
		const dayNumber = index - offset + 1;
		const date = new Date(first);
		date.setUTCDate(dayNumber);
		cells.push({ date: isoDate(date), inMonth: date.getUTCMonth() === first.getUTCMonth() });
	}

	return (
		<div className="cal-picker">
			<div className="cal-head">
				<button
					type="button"
					className="btn ghost small"
					onClick={() => onMonthChange(shiftMonth(month, -1))}
					aria-label="Bulan sebelumnya"
				>
					‹
				</button>
				<span className="cal-title">
					{first.toLocaleDateString("id-ID", {
						month: "long",
						year: "numeric",
						timeZone: "UTC",
					})}
				</span>
				<button
					type="button"
					className="btn ghost small"
					onClick={() => onMonthChange(shiftMonth(month, 1))}
					aria-label="Bulan berikutnya"
				>
					›
				</button>
			</div>

			<div className="cal-grid">
				{WEEKDAYS.map((day) => (
					<span key={day} className="cal-weekday">
						{day}
					</span>
				))}
				{cells.map(({ date, inMonth }) => {
					const disabled = date < min || !inMonth;
					const chosen =
						mode === "range"
							? Boolean(rangeStart) && date >= rangeStart && date <= (rangeEnd || rangeStart)
							: selected.includes(date);
					const dateObject = new Date(`${date}T00:00:00Z`);
					const label = dateObject.toLocaleDateString("id-ID", {
						weekday: "long",
						day: "numeric",
						month: "long",
						year: "numeric",
						timeZone: "UTC",
					});

					return (
						<button
							key={date}
							type="button"
							className={`cal-cell${chosen ? " is-selected" : ""}`}
							aria-pressed={chosen}
							aria-label={label}
							disabled={disabled}
							onClick={() =>
								mode === "range"
									? onRangeClick(date)
									: onToggle(date)
							}
						>
							{Number(date.slice(8, 10))}
						</button>
					);
				})}
			</div>
		</div>
	);
}
