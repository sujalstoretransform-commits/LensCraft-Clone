import { ShieldCheck, Settings, Truck, Headset } from 'lucide-react'

const benefits = [
    {
        title: "Premium Quality",
        description: "Trusted by eyewear professionals",
        Icon: ShieldCheck
    },
    {
        title: "Customizable Options",
        description: "Tailor your lenses to your needs",
        Icon: Settings
    },
    {
        title: "Fast & Reliable",
        description: "Get your lenses on time",
        Icon: Truck
    },
    {
        title: "Expert Support",
        description: "We're here to help",
        Icon: Headset
    },
];

export default function TrustBenefits() {
    return (
        <section className="w-full mt-9 border-y border-slate-200 bg-slate-50 px-6 py-8 md:px-12">
            <div className="mx-auto grid w-full max-w-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0"
            >
                {benefits.map(({ title, description, Icon }, index) => (
                    <div
                        key={title}
                        className={`flex items-center gap-4 lg:px-8 
                            ${index !== 0 ? "lg:border-l lg:border-slate-200" : ""}`
                        }
                    >
                        <Icon
                            size={36}
                            strokeWidth={1.7}
                            className='shrink-0 text-blue-500'
                            aria-hidden='true'
                        />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700">
                                {title}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                {description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
