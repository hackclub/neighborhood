export function useMDXComponents(components) {
	return {
		h1: (props) => (
			<h1
				style={{
					color: "#786A50",
					fontSize: "3.5rem",
					marginTop: "1.65rem",
					marginBottom: "1.65rem",
					fontVariationSettings: '"wght" 600',
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
					lineHeight: 1.1,
				}}
				className="font-bold"
				{...props}
			/>
		),
		h2: (props) => (
			<h2
				style={{
					color: "#786A50",
					fontSize: "2rem",
					marginTop: "1.25rem",
					marginBottom: "1.25rem",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				className="font-bold"
				{...props}
			/>
		),
		h3: (props) => (
			<h3
				style={{
					color: "#786A50",
					fontSize: "1.5rem",
					marginTop: "1rem",
					marginBottom: "1rem",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				className="font-bold"
				{...props}
			/>
		),
		h4: (props) => (
			<h4
				style={{
					color: "#786A50",
					fontSize: "1.25rem",
					marginTop: "0.75rem",
					marginBottom: "0.75rem",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				className="font-bold"
				{...props}
			/>
		),
		br: (props) => <br style={{ margin: "1rem 0" }} {...props} />,
		p: (props) => (
			<p
				style={{
					lineHeight: "1.6",
					fontSize: "1rem",
					marginTop: "1rem",
					marginBottom: "1rem",
					color: "#505E78",
					fontWeight: 400,
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				{...props}
			/>
		),
		a: (props) => (
			<a
				style={{
					color: "#786A50",
					textDecoration: "underline",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				{...props}
			/>
		),
		li: (props) => (
			<li
				style={{
					margin: "0.5rem 0",
					fontWeight: 400,
					color: "#505E78",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				{...props}
			/>
		),
		ul: (props) => (
			<ul
				style={{
					paddingLeft: "1.5rem",
					marginTop: "1rem",
					listStyleType: "disc",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				{...props}
			/>
		),
		ol: (props) => (
			<ol
				style={{
					paddingLeft: "1.5rem",
					marginTop: "1rem",
					listStyleType: "decimal",
					fontFamily:
						"'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
				}}
				{...props}
			/>
		),
		...components,
	};
}
