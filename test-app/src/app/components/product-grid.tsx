"use client";

import { useState } from "react";

export type Product = {
    id: number;
    name: string;
    price: number;
    category: string;
    description: string;
    rating: number;
    stock: number;
    sku: string;
};

const CATEGORY_COLORS: Record<string, string> = {
    Electronics: "bg-blue-900/40 text-blue-300",
    Clothing: "bg-pink-900/40 text-pink-300",
    Books: "bg-yellow-900/40 text-yellow-300",
    Home: "bg-green-900/40 text-green-300",
    Sports: "bg-orange-900/40 text-orange-300",
};

function Stars({ rating }: { rating: number }) {
    return (
        <span className="text-yellow-400 text-xs">
            {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
            <span className="text-zinc-500 ml-1">{rating}</span>
        </span>
    );
}

export default function ProductGrid({ products }: { products: Product[] }) {
    const [selected, setSelected] = useState<number | null>(null);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{products.length} products — paginated, reasonable payload</span>
                <span className="text-yellow-400 font-mono">
                    ~{(JSON.stringify(products).length / 1024).toFixed(1)} KB in props
                </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {products.map((product) => (
                    <button
                        key={product.id}
                        onClick={() => setSelected(selected === product.id ? null : product.id)}
                        className={`text-left p-3 rounded-lg border transition-all ${selected === product.id
                            ? "border-blue-500 bg-blue-950/30"
                            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                            }`}
                    >
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-zinc-200 leading-tight">{product.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[product.category] ?? "bg-zinc-700 text-zinc-300"}`}>
                                {product.category}
                            </span>
                        </div>
                        <Stars rating={product.rating} />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-base font-bold text-white">${product.price.toFixed(2)}</span>
                            <span className={`text-xs ${product.stock < 20 ? "text-red-400" : "text-green-400"}`}>
                                {product.stock < 20 ? `Only ${product.stock} left` : `${product.stock} in stock`}
                            </span>
                        </div>
                        {selected === product.id && (
                            <p className="mt-2 text-xs text-zinc-400 border-t border-zinc-700 pt-2">
                                {product.description}
                                <span className="block mt-1 text-zinc-600">SKU: {product.sku}</span>
                            </p>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
