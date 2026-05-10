import "./App.css";
import AppRouter from "./routes/AppRouter.jsx";
import { SidebarProvider } from "./context/SidebarContext";

export function App() {
  return (
    <SidebarProvider>
      <AppRouter />
    </SidebarProvider>
  );
}

export default App;
