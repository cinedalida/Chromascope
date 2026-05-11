import React, { useState, useEffect } from "react";
import { runFilter } from "../services/productService"; 
import { useUserStore } from "../store/userStore";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  User,
  Bell
} from "lucide-react";

export function IngredientFilterPage() {
  const user = useUserStore((state) => state.user);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [skinType, setSkinType] = useState("Normal"); 
  const [avoidIngredients, setAvoidIngredients] = useState([]);
  const [category, setCategory] = useState("Face");
  
  const categories = ["Face", "Cheeks", "Lips", "Eyes", "Multiuse", "Concealer"];

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const cleanPath = (url) => {
    if (!url) return "/placeholder.png";
    return url.startsWith("/public/") ? url.replace("/public/", "/") : url;
  };

  useEffect(() => {
    if (user) {
      const detectedSkinType = user.skin_type || user.skin_profile?.base_type || "Normal";
      setSkinType(detectedSkinType);

      const detectedIngredients = user.avoid_ingredients || user.skin_profile?.blacklisted_ingredients || [];
      setAvoidIngredients(detectedIngredients);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return; 
    async function loadData() {
      setLoading(true);
      try {
        const results = await runFilter({
          skin_type: skinType,
          avoid_ingredients: avoidIngredients,
          category: category
        });
        setProducts(results.safety_results || []);
      } catch (err) {
        console.error("Database sync error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, category, skinType, avoidIngredients]);

  const filteredProducts = products.filter(p => 
    p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentItems = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex min-h-screen bg-[#FDFBFF] font-sans text-[#1F1924]">
      <main className="flex-1 p-8 lg:p-12 pt-8">
        
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-[#7700CF]">Chromascope</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500">Clinical synthesis</span>
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-[#7700CF] transition-colors"><Bell size={20} /></button>
            <div className="w-8 h-8 rounded-full bg-[#F3E8FF] flex items-center justify-center text-[#7700CF]"><User size={18} /></div>
          </div>
        </header>

        <section className="max-w-[1200px] mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight mb-3 text-[#1F1924]">Scientific Filter</h1>
            <p className="text-gray-500 max-w-2xl leading-relaxed">
              Real-time cross-referencing of 248+ active clinical formulations against your biometric profile.
            </p>
          </div>

          <div className="space-y-6 mb-10">
            <div className="flex flex-wrap items-center p-1 bg-white border border-[#F0E6FA] rounded-2xl w-fit shadow-sm gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setCurrentPage(1); }}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${category === cat ? "bg-[#25004D] text-white shadow-lg" : "text-gray-400 hover:bg-purple-50"}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7700CF]" size={20} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${category} database...`} 
                  className="w-full pl-14 pr-6 py-4 bg-white rounded-full border border-[#F0E6FA] shadow-sm outline-none focus:border-[#7700CF] transition-all" 
                />
              </div>
              <button className="bg-[#5500A0] text-white px-10 py-4 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-[#440080] transition-all">
                <Filter size={18} /> Filter Results
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-3 space-y-6">
              <div className="bg-white p-7 rounded-[32px] border border-[#F0E6FA] shadow-sm">
                <h3 className="font-bold text-lg mb-6">Active Filters</h3>
                <div className="flex flex-col gap-2">
                  {avoidIngredients.map((ing) => (
                    <div key={ing} className="bg-[#F8F2FF] text-[#7700CF] px-4 py-2 rounded-full text-[11px] font-bold border border-[#E9D5FF] flex justify-between items-center">
                      {ing.toUpperCase()}-FREE <X size={12} className="cursor-pointer" />
                    </div>
                  ))}
                  <div className="bg-[#FFF6ED] text-[#EA580C] px-4 py-2 rounded-full text-[11px] font-bold border border-[#FED7AA]">
                    {skinType.toUpperCase()} SKIN
                  </div>
                </div>
              </div>
            </aside>

            <div className="lg:col-span-9">
              <div className="bg-white rounded-[32px] border border-[#F0E6FA] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#F0E6FA] text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                      <th className="px-8 py-6">Product</th>
                      <th className="px-4 py-6">Season Tags</th>
                      <th className="px-4 py-6">Ingredients Preview</th>
                      <th className="px-4 py-6">Status</th>
                      <th className="px-6 py-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      <tr><td colSpan="5" className="py-20 text-center"><Sparkles className="animate-spin mx-auto text-[#7700CF]" /></td></tr>
                    ) : currentItems.length === 0 ? (
                      <tr><td colSpan="5" className="py-20 text-center text-gray-400 font-medium">No compatible products found in this category.</td></tr>
                    ) : currentItems.map((item) => {
                      const seasons = Array.isArray(item.season_tags) 
                        ? item.season_tags 
                        : item.season_tags?.split(",").map(s => s.trim()) || ["Universal"];

                      return (
                        <tr key={item.product_id} className="hover:bg-[#FAF9FF] transition-colors border-b last:border-none border-[#F8F4FF]">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <img src={cleanPath(item.image_url)} className="w-12 h-12 rounded-2xl object-cover bg-gray-50" alt="Product" />
                              <div>
                                <div className="font-bold text-[#1F1924] truncate max-w-[150px]">{item.product_name}</div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{item.brand}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-wrap gap-1">
                              {seasons.map(tag => (
                                <span key={tag} className="bg-[#F3E8FF] text-[#7700CF] text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <p className="text-[11px] text-gray-400 line-clamp-1 max-w-[180px]">
                              {item.full_inci_list || "No ingredient data available."}
                            </p>
                          </td>
                          <td className="px-4 py-5">
                            <StatusBadge type={item.verdict} />
                          </td>
                          <td className="px-6 py-5 text-right">
                            <button className="text-gray-300 hover:text-[#7700CF]"><Eye size={20} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <footer className="flex items-center justify-between px-8 py-6 bg-[#FCFAFF] border-t border-[#F0E6FA]">
                  <div className="text-xs font-medium text-gray-400">
                    Showing {filteredProducts.length === 0 ? 0 : (currentPage-1)*10+1}-{Math.min(currentPage*10, filteredProducts.length)} of {filteredProducts.length} products
                  </div>
                  <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="p-2 text-gray-300 hover:text-[#7700CF] disabled:opacity-20"><ChevronLeft size={20} /></button>
                    <button className="w-8 h-8 rounded-lg text-xs font-bold bg-[#25004D] text-white">{currentPage}</button>
                    <button disabled={currentPage * 10 >= filteredProducts.length} onClick={() => setCurrentPage(currentPage + 1)} className="p-2 text-gray-300 hover:text-[#7700CF] disabled:opacity-20"><ChevronRight size={20} /></button>
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ type }) {
  const verdict = type?.toLowerCase();
  const isSafe = verdict === 'safe';
  const isExcluded = verdict === 'excluded';

  const styles = isSafe 
    ? 'bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]' 
    : isExcluded 
      ? 'bg-rose-50 border-rose-100 text-rose-600'
      : 'bg-[#FFFBEB] border-[#FEF3C7] text-[#D97706]';

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${styles}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${isSafe ? 'bg-[#10B981]' : isExcluded ? 'bg-rose-600' : 'bg-[#F59E0B]'}`} />
      <span className="text-[10px] font-black uppercase tracking-widest">{type || 'Caution'}</span>
    </div>
  );
}