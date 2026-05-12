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
  Bell,
  CheckCircle2,
  Dna,
  Target
} from "lucide-react";

export function IngredientFilterPage() {
  const user = useUserStore((state) => state.user);
  const [products, setProducts] = useState([]);
  const [colorMatches, setColorMatches] = useState([]);
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
      setSkinType(user.skin_type || user.skin_profile?.base_type || "Normal");
      setAvoidIngredients(user.avoid_ingredients || user.skin_profile?.blacklisted_ingredients || []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return; 
    async function loadData() {
      setLoading(true);
      try {
        console.log("[DEBUG] Sending user_lab to API:", user.user_lab);
        const results = await runFilter({
          skin_type: skinType,
          avoid_ingredients: avoidIngredients,
          category: category,
          user_lab: user.user_lab,
          seasonal_label: user.seasonal_label
        });
        const allRanked = results.color_matched || [];
        setProducts(allRanked);
        const seasonOnly = allRanked
          .filter(p => p.is_season_match)
          .sort((a, b) => (a.delta_e ?? 999) - (b.delta_e ?? 999));
        setColorMatches(seasonOnly);
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
          <div className="flex items-center gap-3 text-sm font-medium">
            <Dna size={18} className="text-[#7700CF]" />
            <span className="text-[#7700CF] font-bold uppercase tracking-widest text-[10px]">Genomic Synthesis</span>
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-[#7700CF] transition-colors"><Bell size={20} /></button>
            <div className="w-8 h-8 rounded-full bg-[#F3E8FF] flex items-center justify-center text-[#7700CF] border border-primary/10 shadow-sm"><User size={18} /></div>
          </div>
        </header>

        <section className="max-w-[1200px] mx-auto">
          <div className="mb-10">
            <h1 className="text-5xl font-bold tracking-tighter mb-3 text-[#1F1924] italic uppercase leading-none">Clinical Filter</h1>
            <p className="text-gray-400 max-w-2xl leading-relaxed text-sm font-medium">
              Synchronizing biometric data with 248+ active formulations to ensure biological safety and perceptual accuracy.
            </p>
          </div>

          <div className="space-y-6 mb-10">
            <div className="flex flex-wrap items-center p-1 bg-white border border-[#F0E6FA] rounded-2xl w-fit shadow-sm gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setCurrentPage(1); }}
                  className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${category === cat ? "bg-[#25004D] text-white shadow-lg" : "text-gray-400 hover:bg-purple-50"}`}
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
                  placeholder={`Search clinical ${category} database...`} 
                  className="w-full pl-14 pr-6 py-4 bg-white rounded-full border border-[#F0E6FA] shadow-sm outline-none focus:border-[#7700CF] transition-all text-sm font-medium" 
                />
              </div>
              <button className="bg-[#5500A0] text-white px-10 py-4 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-[#440080] transition-all text-sm uppercase tracking-widest">
                <Filter size={18} /> Process Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-3 space-y-6">
              <div className="bg-white p-7 rounded-[32px] border border-[#F0E6FA] shadow-sm">
                <h3 className="font-bold text-lg mb-6 italic uppercase tracking-tighter">Biometric Tags</h3>
                <div className="flex flex-col gap-2">
                  <div className="bg-[#FFF6ED] text-[#EA580C] px-5 py-3 rounded-2xl text-[10px] font-black border border-[#FED7AA] uppercase tracking-widest text-center">
                    {skinType} Skin
                  </div>
                  {user?.seasonal_label && (
                    <div className="bg-[#7700CF] text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-md">
                      {user.seasonal_label}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <div className="lg:col-span-9 space-y-8">
              {colorMatches.length > 0 && !searchQuery && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 mb-4">
                    <Sparkles size={14} /> Biological Best Matches
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {colorMatches.slice(0, 2).map((item) => (
                      <div key={item.product_id} className="bg-white border-2 border-primary/20 p-5 rounded-[32px] shadow-sm hover:border-primary transition-all flex items-center gap-5 group relative">
                         <div className="absolute top-4 right-4 bg-primary/10 text-primary p-1.5 rounded-full">
                            <Target size={14} />
                         </div>
                        <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-gray-100 shadow-inner bg-gray-50">
                          <img src={cleanPath(item.image_url)} className="w-full h-full object-cover" alt="Recommended" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate uppercase italic tracking-tight">{item.product_name}</h4>
                          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">{item.brand}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-primary">
                            <CheckCircle2 size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                               Accuracy: {item.delta_e !== undefined ? `${Math.max(0, 100 - (item.delta_e * 5)).toFixed(0)}%` : "Clinical Fit"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[32px] border border-[#F0E6FA] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#F0E6FA] text-[10px] uppercase tracking-widest text-gray-400 font-black">
                      <th className="px-8 py-6">Formulation</th>
                      <th className="px-4 py-6">Season Profile</th>
                      <th className="px-4 py-6">Accuracy</th>
                      <th className="px-4 py-6">Status</th>
                      <th className="px-6 py-6 text-right font-bold">Inquiry</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      <tr><td colSpan="5" className="py-20 text-center"><Sparkles className="animate-spin mx-auto text-[#7700CF]" /></td></tr>
                    ) : currentItems.length === 0 ? (
                      <tr><td colSpan="5" className="py-20 text-center text-gray-400 font-medium">No biometric matches found.</td></tr>
                    ) : currentItems.map((item) => {
                      const seasons = Array.isArray(item.season_tags) 
                        ? item.season_tags 
                        : item.season_tags?.split(",").map(s => s.trim()) || ["Universal"];
                      const matchPercent = item.delta_e !== undefined 
                        ? Math.max(0, 100 - (item.delta_e * 5)).toFixed(0) 
                        : null;
                      return (
                        <tr key={item.product_id} className="hover:bg-[#FAF9FF] transition-colors border-b last:border-none border-[#F8F4FF] group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                                <img src={cleanPath(item.image_url)} className="w-full h-full object-cover" alt="Product" />
                              </div>
                              <div>
                                <div className="font-bold text-[#1F1924] truncate max-w-[180px] uppercase tracking-tight italic">{item.product_name}</div>
                                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{item.brand}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex flex-wrap gap-1">
                              {seasons.map(tag => (
                                <span key={tag} className="bg-[#F3E8FF] text-[#7700CF] text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-5">
                             {matchPercent ? (
                               <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black text-primary">{matchPercent}% Match</span>
                                  <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full bg-primary transition-all duration-1000" 
                                        style={{ width: `${matchPercent}%` }}
                                     />
                                  </div>
                               </div>
                             ) : (
                               <span className="text-[9px] font-bold text-gray-200">N/A</span>
                             )}
                          </td>
                          <td className="px-4 py-5">
                            <StatusBadge type={item.verdict} />
                          </td>
                          <td className="px-6 py-5 text-right">
                            <button className="text-gray-200 group-hover:text-primary transition-all p-2"><Eye size={18} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <footer className="flex items-center justify-between px-8 py-6 bg-[#FCFAFF] border-t border-[#F0E6FA]">
                  <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                    Catalog Index: {filteredProducts.length === 0 ? 0 : (currentPage-1)*10+1}-{Math.min(currentPage*10, filteredProducts.length)} / {filteredProducts.length}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="p-2 text-gray-300 hover:text-[#7700CF] disabled:opacity-20"><ChevronLeft size={20} /></button>
                    <button className="w-8 h-8 rounded-xl text-xs font-bold bg-[#25004D] text-white shadow-lg">{currentPage}</button>
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
  const isSafe = verdict === 'safe' || verdict === 'caution';
  const isExcluded = verdict === 'excluded';
  const styles = isSafe 
    ? 'bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]' 
    : isExcluded 
      ? 'bg-rose-50 border-rose-100 text-rose-600'
      : 'bg-[#FFFBEB] border-[#FEF3C7] text-[#D97706]';
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border ${styles}`}>
      <div className={`w-1 h-1 rounded-full ${isSafe ? 'bg-[#10B981]' : isExcluded ? 'bg-rose-600' : 'bg-[#F59E0B]'}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">{type || 'Caution'}</span>
    </div>
  );
}