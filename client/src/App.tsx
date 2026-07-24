import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard";
import Home from "./Home";
import Nav from "./Nav";
import Playground from "./Playground";
import Product from "./Product";
import Reliability from "./Reliability";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-zinc-950">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product" element={<Product />} />
            <Route path="/reliability" element={<Reliability />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
