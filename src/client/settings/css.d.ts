declare module '*.module.css' {
  const styles: Record<string, string>
  export default styles
}

declare module '*?inline' {
  const css: string
  export default css
}
