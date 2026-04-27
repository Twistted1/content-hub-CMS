import React from "react";
import { 
  Database, 
  FileText, 
  Layers, 
  Plus, 
  ChevronRight, 
  Code, 
  Box,
  Layout,
  Globe,
  Settings
} from "lucide-react";

const ContentModelsPage = () => {
  const models = [
    {
      id: "articles",
      name: "Article",
      description: "Deep-dive industry analysis and news reports.",
      fields: 12,
      lastModified: "2 hours ago",
      icon: FileText,
      color: "text-blue-400"
    },
    {
      id: "solutions",
      name: "Solution",
      description: "Service offerings and technical solutions.",
      fields: 8,
      lastModified: "Yesterday",
      icon: Box,
      color: "text-emerald-400"
    },
    {
      id: "projects",
      name: "Project",
      description: "Client case studies and internal projects.",
      fields: 10,
      lastModified: "3 days ago",
      icon: Layers,
      color: "text-purple-400"
    },
    {
      id: "social-posts",
      name: "Social Post",
      description: "Multi-platform automated social content.",
      fields: 6,
      lastModified: "Just now",
      icon: Globe,
      color: "text-orange-400"
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      {/* Header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase">Schema</span>
              <span className="text-xs text-gray-500 font-medium">CONTENT HUB</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Content Models</h1>
          <p className="text-gray-400 max-w-2xl font-medium tracking-wide">
            Define the blueprints and data structures for your headless content delivery.
          </p>
        </div>

        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 font-bold text-sm tracking-wide">
          <Plus className="w-4 h-4" />
          Create New Model
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-6">
        {models.map((model) => (
          <div key={model.id} className="bg-[#0A0A0A] border border-white/[0.03] p-8 rounded-3xl group hover:border-blue-500/20 transition-all relative overflow-hidden">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:border-blue-500/30 transition-all`}>
                  <model.icon className={`w-6 h-6 ${model.color}`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight group-hover:text-blue-400 transition-colors">{model.name}</h3>
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{model.fields} Fields defined</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                  <Code className="w-4 h-4 text-gray-400" />
                </button>
                <button className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mb-8 font-medium italic">
              "{model.description}"
            </p>

            <div className="flex items-center justify-between pt-6 border-t border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-gray-600" />
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Last modified {model.lastModified}</span>
              </div>
              <button className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors tracking-wider">
                Edit Schema
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Empty State / Create More */}
        <div className="bg-[#0A0A0A] border-2 border-dashed border-white/[0.03] rounded-3xl p-8 flex flex-col items-center justify-center text-center group hover:border-blue-500/10 transition-all cursor-pointer">
          <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8 text-gray-600" />
          </div>
          <h4 className="font-bold text-gray-500 uppercase tracking-widest mb-1 text-sm">Add custom model</h4>
          <p className="text-xs text-gray-700 font-medium tracking-tight">Extend your schema with new data types</p>
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-12 bg-blue-500/5 border border-blue-500/10 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <Box className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-bold tracking-tight uppercase">Architect's Note</h2>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
          Content Models define the structure of your data. Think of them as the blueprint for your Headless CMS. 
          When you create an "Article" model, you're telling the system that every article must have a title, 
          a body, an author, and an image. This ensures consistency across all your automated content streams.
        </p>
      </div>
    </div>
  );
};

export default ContentModelsPage;
