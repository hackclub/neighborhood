"use client";
import info from "@/info.json";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Tabs({ setSidebarOpen }) {
	const pathname = usePathname();
	const currentId = pathname.split("/").pop();

	return (
		<nav>
			<ul className="space-y-3">
				<div className="text-sm font-bold text-slate-500 uppercase tracking-wide">
					Information
				</div>
				{info.map((item) => {
					const isActive = currentId === item.slug;
					return (
						<li
							key={item.name}
							onClick={() => setSidebarOpen && setSidebarOpen(false)}
						>
							<Link
								href={`/info/${item.slug}`}
								className={`flex items-center justify-between rounded px-4 py-2 text-base transition-colors ${
									isActive
										? "bg-blue-600 text-white font-semibold shadow"
										: "bg-slate-100 text-slate-700 hover:bg-blue-100"
								}`}
							>
								<span className="text-xl">{item.emoji}</span>
								<span>{item.name}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
