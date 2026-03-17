import Link from "next/link"
import { ArrowRight, Layers, Zap, Sliders } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">K</span>
            </div>
            <span className="font-semibold text-gray-900">Kaykov Media</span>
          </div>
          <Link
            href="/generate"
            className="bg-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Start Free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full mb-8">
            <Zap size={14} />
            <span>AI-powered storefront mockups</span>
          </div>

          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            See your sign on your
            <br />
            <span className="text-gray-500">storefront before you build it</span>
          </h1>

          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload a photo of your storefront, choose a style, and get realistic
            sign mockups in seconds. No design skills needed.
          </p>

          <Link
            href="/generate"
            className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-xl text-base font-medium hover:bg-gray-800 transition-colors"
          >
            Generate My Sign
            <ArrowRight size={18} />
          </Link>

          <p className="mt-4 text-sm text-gray-400">No account needed · Free to try</p>
        </section>

        {/* How it works */}
        <section className="border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <Step
                icon={<Layers size={24} />}
                number="1"
                title="Upload & choose style"
                description="Photo of your storefront + your logo or name. Pick a sign style from our curated examples."
              />
              <Step
                icon={<Zap size={24} />}
                number="2"
                title="Generate variations"
                description="Choose 1, 3, or 6 design options. Our AI creates realistic, style-consistent mockups."
              />
              <Step
                icon={<Sliders size={24} />}
                number="3"
                title="Adjust & finalize"
                description="Fine-tune colors, lighting, and see day vs. night previews. No full regeneration for small tweaks."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <p className="text-center text-sm text-gray-400">
          © {new Date().getFullYear()} Kaykov Media
        </p>
      </footer>
    </div>
  )
}

function Step({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode
  number: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-700">
          {icon}
        </div>
        <span className="text-4xl font-bold text-gray-100">{number}</span>
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
