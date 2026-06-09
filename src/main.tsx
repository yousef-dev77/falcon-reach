import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installReadOnlyInterceptor } from "./lib/readOnlyGuard";

installReadOnlyInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
