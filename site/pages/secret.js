import Head from "next/head";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Home.module.css";

const menuOptions = [
	"Join Neighborhood",
	"Read Personal Letter",
	"Watch Music Video",
];

export default function Home() {
	const router = useRouter();
	const [hovered, setHovered] = useState(null);
	const [underlineWidths, setUnderlineWidths] = useState([]);
	const [displayedText, setDisplayedText] = useState("");
	const [showMenu, setShowMenu] = useState(false);
	const [menuMode, setMenuMode] = useState("default");
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		birthday: "",
	});
	const textRefs = useRef([]);
	const [fullText, setFullText] = useState("");
	const [waitingForNextMessage, setWaitingForNextMessage] = useState(false);
	const [hasShownReferral, setHasShownReferral] = useState(false);
	const [showReferralLink, setShowReferralLink] = useState(false);
	const [copied, setCopied] = useState(false);

	const bounceKeyframes = `
    @keyframes gentleBounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-6px);
      }
    }
  `;

	useEffect(() => {
		if (router.isReady) {
			const { name, email, birthday } = router.query;
			setFormData((prev) => ({
				...prev,
				name: name || prev.name,
				email: email || prev.email,
				birthday: birthday || prev.birthday,
			}));
		}
	}, [router.isReady, router.query]);

	useEffect(() => {
		if (menuMode === "signedUp") {
			setFullText(
				`Awesome! I've sent to your email (${formData.email}) the Neighborhood Disc, a cal invite to our kickoff May 9th 7:30pm EST, and a sweet getting started guide`
			);
		} else {
			setFullText(
				formData.name
					? `howdy ${formData.name}! if you spend 100 hours coding your own app this May, you're guaranteed a flight to SF and a spot in one of our houses from June through August`
					: "howdy! if you spend 100 hours coding your own app this May, you're guaranteed a flight to SF and a spot in one of our houses starting June"
			);
		}
	}, [formData.name, menuMode, formData.email]);

	const handleMenuClick = (option) => {
		if (option === "Join Neighborhood" && formData.email) {
			console.log("User email:", formData.email);
			setMenuMode("signedUp");
			setDisplayedText("");
			setShowMenu(false);
		}
	};

	useEffect(() => {
		if (!fullText) return;

		let currentIndex = 0;
		setDisplayedText("");

		if (hasShownReferral) setShowReferralLink(false);

		const interval = setInterval(() => {
			if (currentIndex < fullText.length) {
				setDisplayedText(fullText.substring(0, currentIndex + 1));
				currentIndex++;
			} else {
				clearInterval(interval);
				if (menuMode === "signedUp" && !hasShownReferral) {
					setWaitingForNextMessage(true);
				} else {
					setTimeout(() => {
						setShowMenu(true);
					}, 375);
				}
				if (hasShownReferral) {
					setTimeout(() => setShowReferralLink(true), 200);
				}
			}
		}, 37.5);

		return () => clearInterval(interval);
	}, [fullText, hasShownReferral]);

	useEffect(() => {
		if (showMenu) {
			setUnderlineWidths(
				textRefs.current.map((ref) => (ref ? ref.offsetWidth : 0))
			);
		}
	}, [showMenu]);

	const handleBubbleClick = () => {
		if (waitingForNextMessage && !hasShownReferral) {
			setWaitingForNextMessage(false);
			setHasShownReferral(true);
			setFullText(
				"We're running a referral raffle for a five course meal for two at the latest Michelin Star restaurant in SF (7 Adams). You'll get a raffle ticket for every friend you invite"
			);
			setDisplayedText("");
			setShowMenu(false);
		} else if (waitingForNextMessage && hasShownReferral) {
			setWaitingForNextMessage(false);
			setMenuMode("default");
			setShowMenu(false);
			setDisplayedText("");
			setHasShownReferral(false);
		}
	};

	return (
		<>
			<style>{bounceKeyframes}</style>
			<Head>
				<title>Neighborhood</title>
				<meta name="description" content="somewhere new" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<div
				style={{
					display: "flex",
					height: "100vh",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
					backgroundImage: "url('/animal-crossing-island.png')",
					backgroundSize: "cover",
					backgroundPosition: "center",
					backgroundRepeat: "no-repeat",
					width: "100vw",
				}}
			>
				<img
					style={{ maxWidth: "100%", zIndex: 3, width: 496, paddingRight: 142 }}
					src="./neighborhoodLogo.png"
				/>
				<div style={{ position: "relative", zIndex: 2, marginTop: -68 }}>
					{!waitingForNextMessage && !hasShownReferral && (
						<div
							style={{
								position: "absolute",
								zIndex: 2,
								right: -72,
								bottom: -48,
								backgroundColor: "#FFEEA0",
								width: 240,
								height: 115,
								borderRadius: 200,
								display: "flex",
								flexDirection: "column",
								justifyContent: "center",
								opacity: showMenu ? 1 : 0,
								transform: showMenu ? "scale(1)" : "scale(0)",
								transition: "all 0.375s ease-out",
							}}
						>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: 0,
									marginLeft: 8,
									paddingLeft: 16,
									color: "#786A50",
									fontWeight: 700,
									position: "relative",
								}}
							>
								{menuOptions.map((option, idx) => (
									<div
										key={option}
										style={{
											position: "relative",
											cursor: "pointer",
											display: "flex",
											alignItems: "center",
										}}
										onMouseEnter={() => setHovered(idx)}
										onMouseLeave={() => setHovered(null)}
										onClick={() => handleMenuClick(option)}
									>
										<p
											ref={(el) => (textRefs.current[idx] = el)}
											style={{
												zIndex: 2,
												margin: 0,
												fontWeight: 700,
												fontSize: "1.1rem",
												position: "relative",
												padding: 0,
											}}
										>
											{option}
										</p>
										<div
											style={{
												position: "absolute",
												left: -4,
												bottom: 0,
												height: 12,
												borderRadius: 8,
												background:
													idx === 0
														? "#FF7C68"
														: idx === 1
														? "#A4D4A2"
														: "#F5C24C",
												zIndex: 1,
												opacity: hovered === idx ? 0.4 : 0.6,
												width:
													hovered === idx && underlineWidths[idx]
														? underlineWidths[idx] + 8
														: 0,
												transition: "width 0.22s linear, opacity 0.15s linear",
												pointerEvents: "none",
											}}
										/>
									</div>
								))}
							</div>
						</div>
					)}
					{waitingForNextMessage && (
						<div
							style={{
								position: "absolute",
								zIndex: 2,
								left: "calc(50% - 24px)",
								bottom: -20,
								transform: "translateX(-50%)",
								width: 48,
								height: 48,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								cursor: "pointer",
								animation: "gentleBounce 2s ease-in-out infinite",
							}}
						>
							<svg width="32" height="32" viewBox="0 0 32 32">
								<polygon
									points="16,28 4,8 28,8"
									fill="#F5C24C"
									stroke="#E2A800"
									strokeWidth="2"
								/>
							</svg>
						</div>
					)}
					{hasShownReferral && !waitingForNextMessage && (
						<div
							style={{
								position: "absolute",
								zIndex: 2,
								left: "50%",
								bottom: -80,
								transform: "translateX(-50%)",
								transition: "all 0.35s cubic-bezier(.68,-0.55,.27,1.55)",
								opacity: showReferralLink ? 1 : 0,
								scale: showReferralLink ? 1 : 0.7,
								backgroundColor: "#FCEA64",
								borderRadius: 12,
								padding: "10px 18px",
								display: showReferralLink ? "flex" : "none",
								alignItems: "center",
								boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
								gap: 8,
								minWidth: 260,
								border: "1px solid #786A50",
								fontWeight: 600,
								fontSize: 15,
								cursor: "default",
							}}
						>
							<span
								style={{
									overflow: "hidden",
									maxWidth: 320,
									color: "#786A50",
									whiteSpace: "nowrap",
								}}
							>{`neighborhood.hackclub.com/?ref=${
								formData.name || "yourname"
							}`}</span>
							<button
								style={{
									marginLeft: 10,
									background: "#786A50",
									border: "none",
									borderRadius: 6,
									padding: "4px 10px",
									fontWeight: 700,
									color: "#FCEA64",
									cursor: "pointer",
									boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
									transition: "all 0.2s ease-out",
								}}
								onClick={() => {
									navigator.clipboard.writeText(
										`http://neighborhood.hackclub.com/?ref=${
											formData.name || "yourname"
										}`
									);
									setCopied(true);
									setTimeout(() => setCopied(false), 2000);
								}}
							>
								{copied ? "Copied" : "Copy"}
							</button>
						</div>
					)}
					<div
						style={{
							position: "relative",
							zIndex: 1,
							cursor: waitingForNextMessage ? "pointer" : "default",
						}}
						onClick={handleBubbleClick}
					>
						<p
							style={{
								width: 300,
								position: "absolute",
								left: "50%",
								top: "30%",
								fontWeight: 600,
								color: "#786A50",
								transform: "translateX(-50%)",
								textAlign: "left",
								whiteSpace: "pre-wrap",
								wordWrap: "break-word",
							}}
						>
							{displayedText}
						</p>
						<img src="textBubble.svg" />
					</div>
				</div>
				<br />
			</div>
		</>
	);
}
