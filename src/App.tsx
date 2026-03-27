import { useState, useEffect, useMemo, useCallback, type SyntheticEvent } from 'react';
import {
  ShoppingCart,
  Heart,
  Search,
  Menu,
  X,
  Star,
  Truck,
  Flower2,
  Award,
  Clock,
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  Share2,
  Users,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { LilarProductCard } from '@/components/lilar/ProductCard';
import { HeroCarousel, type HeroSlide } from '@/components/lilar/HeroCarousel';
import { fetchCatalogFromDb, postCatalogSync } from '@/catalog/fetchCatalog';
import { productMatchesCategoryPath } from '@/moysklad/categoryPath';
import type { CatalogProduct } from '@/moysklad/mapProduct';
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  PRODUCT_IMAGE_PLACEHOLDER_DATA,
  HERO_IMAGE_URL,
  HERO_FALLBACK_DATA,
} from '@/moysklad/placeholderImage';

function onProductImageError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.src.startsWith("data:")) return;
  el.onerror = null;
  // Уже показываем файл-заглушку, но он не загрузился → инлайн SVG
  if (el.src.includes("product-placeholder.png")) {
    el.src = PRODUCT_IMAGE_PLACEHOLDER_DATA;
    return;
  }
  el.src = PRODUCT_IMAGE_PLACEHOLDER;
}

function onHeroImageError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.src.startsWith('data:')) return;
  el.onerror = null;
  el.src = HERO_FALLBACK_DATA;
}

function onHeroCarouselImageError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.src.includes('hero-bouquet')) {
    onHeroImageError(e);
  } else {
    onProductImageError(e);
  }
}

type Product = CatalogProduct;

interface CartItem extends Product {
  quantity: number;
}

const reviews = [
  {
    id: 1,
    name: 'Анна Петрова',
    rating: 5,
    text: 'Очень довольна! Букет был просто великолепен, доставка вовремя. Обязательно закажу ещё!',
    date: '12 мая 2024'
  },
  {
    id: 2,
    name: 'Михаил Сидоров',
    rating: 5,
    text: 'Заказал цветы жене на годовщину. Она в восторге! Свежие цветы, красивая упаковка.',
    date: '8 мая 2024'
  },
  {
    id: 3,
    name: 'Елена Козлова',
    rating: 4,
    text: 'Отличный сервис! Консультант помогла подобрать идеальный букет для мамы.',
    date: '5 мая 2024'
  }
];

function ReviewAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="w-14 h-14 rounded-full border-2 border-[var(--lilar-primary)]/30 flex items-center justify-center text-sm font-bold text-white shrink-0 bg-gradient-to-br from-[var(--lilar-primary)] to-emerald-800"
      aria-hidden
    >
      {initials}
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderPaths, setFolderPaths] = useState<string[]>([]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const { products: list, folderPaths: folders } = await fetchCatalogFromDb();
      setProducts(list);
      setFolderPaths(folders);
      setCart((prev) =>
        prev.map((item) => {
          const fresh = list.find((p) => p.id === item.id);
          return fresh ? { ...fresh, quantity: item.quantity } : item;
        })
      );
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : String(e));
      setProducts([]);
      setFolderPaths([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const syncFromMoysklad = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      await postCatalogSync();
      const { products: list, folderPaths: folders } = await fetchCatalogFromDb();
      setProducts(list);
      setFolderPaths(folders);
      setCart((prev) =>
        prev.map((item) => {
          const fresh = list.find((p) => p.id === item.id);
          return fresh ? { ...fresh, quantity: item.quantity } : item;
        })
      );
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : String(e));
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    products.forEach((p) => names.add(p.category));
    folderPaths.forEach((f) => names.add(f));
    const sorted = Array.from(names)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ru'));
    return [
      { name: 'Все', icon: '🌸' },
      ...sorted.map((n) => ({ name: n, icon: '🌿' })),
    ];
  }, [products, folderPaths]);

  /** Превью категории в hero: первое фото товара из группы или заглушка (как сетка на lilar.ru). */
  const categoryHeroChips = useMemo(() => {
    return categories
      .filter((c) => c.name !== 'Все')
      .map((c) => {
        const product = products.find(
          (p) =>
            productMatchesCategoryPath(p.category, c.name) &&
            p.image &&
            String(p.image).trim() !== ''
        );
        return {
          name: c.name,
          image: product?.image ?? PRODUCT_IMAGE_PLACEHOLDER,
        };
      });
  }, [categories, products]);

  const heroSlides = useMemo((): HeroSlide[] => {
    const out: HeroSlide[] = [];
    const seen = new Set<string>();
    for (const p of products) {
      const src = p.image?.trim();
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push({
        src,
        title: p.name,
        href: '#catalog-full',
      });
      if (out.length >= 5) break;
    }
    if (out.length === 0) {
      return [
        {
          src: HERO_IMAGE_URL,
          title: 'Доставка цветов — выберите букет онлайн',
          href: '#catalog-hits',
        },
      ];
    }
    return out;
  }, [products]);

  useEffect(() => {
    if (selectedCategory === 'Все') return;
    const valid = new Set(categories.map((c) => c.name));
    if (!valid.has(selectedCategory)) {
      setSelectedCategory('Все');
    }
  }, [categories, selectedCategory]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = productMatchesCategoryPath(
      product.category,
      selectedCategory
    );
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q) ||
      (product.code?.toLowerCase().includes(q) ?? false) ||
      (product.article?.toLowerCase().includes(q) ?? false) ||
      (product.barcodes?.toLowerCase().includes(q) ?? false);
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const hitsProducts = useMemo(() => products.slice(0, 12), [products]);
  const showcaseCats = useMemo(
    () => folderPaths.filter(Boolean).slice(0, 4),
    [folderPaths]
  );
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqItems = [
    {
      q: 'Как оформить заказ?',
      a: 'Выберите букет в каталоге, добавьте в корзину и нажмите «Оформить заказ» — мы свяжемся для уточнения деталей доставки.',
    },
    {
      q: 'Насколько актуальный каталог?',
      a: 'Товары и фото подгружаются из МойСклад и периодически синхронизируются с базой на сервере.',
    },
    {
      q: 'Есть ли доставка?',
      a: 'Условия и стоимость доставки уточняйте по телефону — подберём удобное время.',
    },
    {
      q: 'Можно ли заказать срочно?',
      a: 'Зависит от загрузки и наличия — позвоните, и мы предложим ближайшее окно.',
    },
  ];

  const scrollToCatalog = (categoryName: string) => {
    setSelectedCategory(categoryName);
    document.getElementById('catalog-full')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--lilar-bg)]">
      {/* Верхняя полоса — как у крупных витрин */}
      <div className="hidden sm:block bg-[var(--lilar-topbar)] text-white text-xs py-2">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-between items-center gap-2">
          <span>Доставка цветов · заказ онлайн · каталог из базы</span>
          <div className="flex items-center gap-4">
            <a href="tel:+78001234567" className="font-semibold tracking-wide">
              8 800 123-45-67
            </a>
            <button
              type="button"
              onClick={() => void syncFromMoysklad()}
              disabled={productsLoading}
              className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${productsLoading ? 'animate-spin' : ''}`} />
              Обновить из МойСклад
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[var(--lilar-border)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 lg:gap-6">
            <a href="#" className="flex items-center gap-2 shrink-0">
              <Flower2 className="w-9 h-9 text-[var(--lilar-primary)]" />
              <span className="text-lg sm:text-xl font-bold text-[var(--lilar-text)]">
                Цветочный Рай
              </span>
            </a>
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-neutral-700">
              <a href="#catalog-hits" className="hover:text-[var(--lilar-primary)] transition-colors">
                Хиты
              </a>
              <a href="#catalog-full" className="hover:text-[var(--lilar-primary)] transition-colors">
                Каталог
              </a>
              <a href="#about" className="hover:text-[var(--lilar-primary)] transition-colors">
                О нас
              </a>
              <a href="#faq" className="hover:text-[var(--lilar-primary)] transition-colors">
                Вопросы
              </a>
              <a href="#reviews" className="hover:text-[var(--lilar-primary)] transition-colors">
                Отзывы
              </a>
              <a href="#contacts" className="hover:text-[var(--lilar-primary)] transition-colors">
                Контакты
              </a>
            </nav>
            <div className="hidden md:flex flex-1 max-w-md mx-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Что ищете?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[var(--lilar-border)] bg-[#fafaf9] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--lilar-primary)]/30"
                />
              </div>
            </div>
            <a href="tel:+78001234567" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[var(--lilar-primary)] shrink-0">
              <Phone className="w-4 h-4" />
              8 800 123-45-67
            </a>
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              <button
                type="button"
                className="p-2 rounded-full hover:bg-neutral-100 transition-colors relative"
                aria-label="Избранное"
              >
                <Heart className="w-5 h-5 text-neutral-600" />
                {favorites.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-0.5 bg-[var(--lilar-primary)] text-white text-[10px] rounded-full flex items-center justify-center">
                    {favorites.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="p-2 rounded-full hover:bg-neutral-100 transition-colors relative"
                aria-label="Корзина"
              >
                <ShoppingCart className="w-5 h-5 text-neutral-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-0.5 bg-[var(--lilar-primary)] text-white text-[10px] rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-full hover:bg-neutral-100"
                aria-label="Меню"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--lilar-border)] bg-white">
            <nav className="flex flex-col p-4 gap-3 text-sm font-medium">
              <a href="#catalog-full" onClick={() => setIsMobileMenuOpen(false)} className="py-1">
                Каталог
              </a>
              <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="py-1">
                О нас
              </a>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="py-1">
                Вопросы
              </a>
              <a href="#reviews" onClick={() => setIsMobileMenuOpen(false)} className="py-1">
                Отзывы
              </a>
              <a href="#contacts" onClick={() => setIsMobileMenuOpen(false)} className="py-1">
                Контакты
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* Герой + чипы категорий */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#e8f0eb] via-[#f5f3ef] to-[#ede8e0] border-b border-[var(--lilar-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-7">
          <h1 className="sr-only">Доставка цветов — выберите букет онлайн</h1>
          <HeroCarousel slides={heroSlides} onImageError={onHeroCarouselImageError} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <p className="text-xs text-[var(--lilar-muted)] mb-3">Категории</p>
          <div
            className="grid w-full gap-0.5 sm:gap-1"
            style={{
              gridTemplateColumns:
                categoryHeroChips.length > 0
                  ? `repeat(${categoryHeroChips.length}, minmax(0, 1fr))`
                  : undefined,
            }}
          >
            {categoryHeroChips.map(({ name, image }) => (
              <button
                key={name}
                type="button"
                onClick={() => scrollToCatalog(name)}
                aria-label={`Перейти к категории: ${name}`}
                className="group flex min-w-0 w-full flex-col items-center text-left"
              >
                <div className="relative mx-auto aspect-square w-full max-w-[6.75rem] sm:max-w-[7.75rem] rounded-xl overflow-hidden border border-[var(--lilar-border)] bg-white shadow-sm transition-all group-hover:border-[var(--lilar-primary)] group-hover:shadow-md">
                  <img
                    src={image}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={onProductImageError}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <span className="mt-2 px-0.5 w-full text-center text-[10px] sm:text-[11px] font-medium text-[var(--lilar-text)] leading-snug line-clamp-2 group-hover:text-[var(--lilar-primary)] transition-colors">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Преимущества — ряд иконок */}
      <section id="about" className="py-10 bg-white border-b border-[var(--lilar-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Truck, t: 'Доставка', d: 'Уточняйте время с оператором' },
              { icon: Flower2, t: 'Свежесть', d: 'Каталог из МойСклад и БД' },
              { icon: Award, t: 'Качество', d: 'Фото и описания в карточке' },
              { icon: Clock, t: '24/7', d: 'Заказ на сайте в любое время' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="text-center p-4 rounded-xl bg-[var(--lilar-bg)] border border-[var(--lilar-border)]">
                <div className="w-12 h-12 mx-auto rounded-full bg-[var(--lilar-primary)]/10 flex items-center justify-center mb-3">
                  <Icon className="w-6 h-6 text-[var(--lilar-primary)]" />
                </div>
                <h3 className="font-bold text-[var(--lilar-text)] text-sm">{t}</h3>
                <p className="text-xs text-[var(--lilar-muted)] mt-1">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Хиты продаж */}
      <section id="catalog-hits" className="py-12 bg-[var(--lilar-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--lilar-text)]">Хиты продаж</h2>
              <p className="text-sm text-[var(--lilar-muted)] mt-1">Популярные позиции из каталога</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void syncFromMoysklad()}
                disabled={productsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--lilar-border)] bg-white text-sm font-medium text-[var(--lilar-primary)] hover:bg-[var(--lilar-bg)] disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${productsLoading ? 'animate-spin' : ''}`} />
                Синхронизация МойСклад → БД
              </button>
              <button
                type="button"
                onClick={() => scrollToCatalog('Все')}
                className="text-sm font-medium text-[var(--lilar-primary)] underline underline-offset-2"
              >
                Весь каталог
              </button>
            </div>
          </div>
          {productsLoading && (
            <p className="text-center text-[var(--lilar-muted)] py-12">Загрузка каталога из базы…</p>
          )}
          {productsError && (
            <div className="max-w-2xl mx-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {productsError}
            </div>
          )}
          {!productsLoading && !productsError && hitsProducts.length === 0 && (
            <p className="text-center text-[var(--lilar-muted)] py-12">Пока нет товаров в базе.</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {hitsProducts.map((product) => (
              <LilarProductCard
                key={product.id}
                product={product}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onAddToCart={addToCart}
                onImageError={onProductImageError}
                compact
              />
            ))}
          </div>
        </div>
      </section>

      {/* Ряды по категориям */}
      {showcaseCats.map((cat) => {
        const row = products
          .filter((p) => productMatchesCategoryPath(p.category, cat))
          .slice(0, 8);
        if (row.length === 0) return null;
        return (
          <section
            key={cat}
            className="py-10 bg-white border-b border-[var(--lilar-border)]"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--lilar-text)]">{cat}</h2>
                <button
                  type="button"
                  onClick={() => scrollToCatalog(cat)}
                  className="text-sm font-semibold text-[var(--lilar-primary)] hover:underline shrink-0"
                >
                  Смотреть все
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {row.map((product) => (
                  <LilarProductCard
                    key={product.id}
                    product={product}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onAddToCart={addToCart}
                    onImageError={onProductImageError}
                    compact
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Полный каталог: поиск + фильтры */}
      <section id="catalog-full" className="py-12 bg-[var(--lilar-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--lilar-text)] mb-2">Каталог</h2>
          <p className="text-sm text-[var(--lilar-muted)] mb-8">
            Поиск и фильтр по группам из МойСклад
          </p>

          <div className="mb-8 space-y-6">
            <div className="max-w-md md:hidden">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Поиск букета..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-[var(--lilar-border)] rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-[var(--lilar-primary)]/25"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  title={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`max-w-[min(100%,20rem)] px-4 py-2.5 rounded-full text-sm font-medium transition-all text-left ${
                    selectedCategory === category.name
                      ? 'bg-[var(--lilar-primary)] text-white shadow-md'
                      : 'bg-white text-[var(--lilar-text)] border border-[var(--lilar-border)] hover:border-[var(--lilar-primary)]'
                  }`}
                >
                  <span className="mr-1.5">{category.icon}</span>
                  <span className="align-middle line-clamp-2 break-words">{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          {productsLoading && (
            <p className="text-center text-[var(--lilar-muted)] py-12">Загрузка каталога из базы…</p>
          )}
          {!productsLoading && !productsError && filteredProducts.length === 0 && (
            <p className="text-center text-[var(--lilar-muted)] py-12">Нет товаров по выбранным условиям.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-[var(--lilar-card)] rounded-xl border border-[var(--lilar-border)] shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-square bg-[#f0ebe4] overflow-hidden">
                  <img
                    src={product.image || PRODUCT_IMAGE_PLACEHOLDER}
                    alt={product.name}
                    onError={onProductImageError}
                    decoding="async"
                    className="w-full h-full object-cover object-center"
                  />
                  <button
                    type="button"
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        favorites.includes(product.id)
                          ? 'fill-[var(--lilar-primary)] text-[var(--lilar-primary)]'
                          : 'text-neutral-400'
                      }`}
                    />
                  </button>
                  {product.oldPrice && product.oldPrice > product.price && (
                    <div className="absolute top-2 left-2 bg-[var(--lilar-sale)] text-white px-2 py-0.5 rounded text-xs font-bold">
                      -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    {product.rating > 0 ? (
                      <>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-[var(--lilar-muted)]">{product.rating}</span>
                      </>
                    ) : null}
                    <span className="text-xs text-[var(--lilar-muted)]">({product.category})</span>
                  </div>
                  <h3 className="font-bold text-[var(--lilar-text)] text-sm mb-2 line-clamp-2">{product.name}</h3>
                  <div className="text-[11px] text-[var(--lilar-muted)] space-y-0.5 mb-2">
                    {product.code != null && product.code !== '' && (
                      <div>Код: <span className="font-mono">{product.code}</span></div>
                    )}
                    {product.article != null && product.article !== '' && (
                      <div>Артикул: <span className="font-mono">{product.article}</span></div>
                    )}
                    {product.externalCode != null && product.externalCode !== '' && (
                      <div>Внешний код: <span className="font-mono break-all">{product.externalCode}</span></div>
                    )}
                    {product.barcodes != null && product.barcodes !== '' && (
                      <div>Штрихкод: <span className="font-mono">{product.barcodes}</span></div>
                    )}
                    {product.weightKg != null && product.weightKg > 0 && (
                      <div>Вес: {product.weightKg < 1 ? `${Math.round(product.weightKg * 1000)} г` : `${product.weightKg.toFixed(2)} кг`}</div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--lilar-muted)] mb-2 line-clamp-2">{product.description}</p>
                  {product.salePricesLabels.length > 0 && (
                    <ul className="text-[11px] text-[var(--lilar-muted)] mb-2 space-y-0.5">
                      {product.salePricesLabels.map((sp, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{sp.label}</span>
                          <span className="font-medium">{sp.rub.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--lilar-border)]">
                    <div>
                      <span className="text-lg font-bold text-[var(--lilar-text)]">
                        {product.price > 0
                          ? `${product.price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`
                          : '—'}
                      </span>
                      {product.oldPrice != null && product.oldPrice > product.price && (
                        <span className="text-xs text-[var(--lilar-muted)] line-through ml-2">
                          {product.oldPrice.toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={product.price <= 0}
                      onClick={() => addToCart(product)}
                      className="w-10 h-10 shrink-0 bg-[var(--lilar-primary)] text-white rounded-full flex items-center justify-center hover:bg-[var(--lilar-primary-hover)] disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-12 bg-white border-t border-[var(--lilar-border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[var(--lilar-text)] text-center mb-8">Частые вопросы</h2>
          <div className="space-y-2">
            {faqItems.map((item, i) => (
              <div
                key={item.q}
                className="border border-[var(--lilar-border)] rounded-xl overflow-hidden bg-[var(--lilar-bg)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 text-left px-4 py-3 font-semibold text-[var(--lilar-text)] text-sm sm:text-base"
                >
                  {item.q}
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-[var(--lilar-primary)] transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-[var(--lilar-muted)] border-t border-[var(--lilar-border)] pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Отзывы */}
      <section id="reviews" className="py-14 bg-[var(--lilar-bg)] border-t border-[var(--lilar-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--lilar-text)] mb-2">Отзывы клиентов</h2>
            <p className="text-sm text-[var(--lilar-muted)]">Что говорят о нас покупатели</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-xl p-6 border border-[var(--lilar-border)] shadow-sm"
              >
                <div className="flex items-center gap-4 mb-4">
                  <ReviewAvatar name={review.name} />
                  <div>
                    <div className="font-bold text-[var(--lilar-text)]">{review.name}</div>
                    <div className="text-xs text-[var(--lilar-muted)]">{review.date}</div>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-[var(--lilar-muted)] leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-[var(--lilar-primary)] p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_30%_20%,#fff_0%,transparent_50%)]" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
                Готовы порадовать близких?
              </h2>
              <p className="text-white/90 text-sm sm:text-base mb-8 max-w-xl mx-auto">
                Выберите букет в каталоге, добавьте в корзину — мы свяжемся для уточнения деталей.
              </p>
              <a
                href="#catalog-full"
                className="inline-flex items-center gap-2 bg-white text-[var(--lilar-primary)] px-8 py-3.5 rounded-full font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transition-shadow"
              >
                Перейти в каталог
                <ChevronRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacts" className="bg-[#1c1917] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Flower2 className="w-8 h-8 text-emerald-400" />
                <span className="text-xl font-bold">Цветочный Рай</span>
              </div>
              <p className="text-neutral-400 text-sm mb-4">
                Интернет-магазин цветов: каталог из базы, оплата и доставка по договорённости.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 bg-neutral-800 hover:bg-[var(--lilar-primary)] rounded-full flex items-center justify-center transition-colors" aria-label="Соцсеть">
                  <Share2 className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 bg-neutral-800 hover:bg-[var(--lilar-primary)] rounded-full flex items-center justify-center transition-colors" aria-label="Соцсеть">
                  <Users className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-4 uppercase tracking-wide text-neutral-300">Навигация</h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><a href="#catalog-full" className="hover:text-white transition-colors">Каталог</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">О нас</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">Вопросы</a></li>
                <li><a href="#reviews" className="hover:text-white transition-colors">Отзывы</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-4 uppercase tracking-wide text-neutral-300">Категории</h3>
              <ul className="space-y-2 text-sm text-neutral-400">
                {folderPaths.slice(0, 6).map((f) => (
                  <li key={f}>
                    <button type="button" onClick={() => scrollToCatalog(f)} className="hover:text-white text-left transition-colors">
                      {f}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-4 uppercase tracking-wide text-neutral-300">Контакты</h3>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href="tel:+78001234567" className="hover:text-white">8 800 123-45-67</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href="mailto:info@flowers.ru" className="hover:text-white">info@flowers.ru</a>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Москва, доставка по договорённости</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 mt-10 pt-8 text-center text-xs text-neutral-500">
            <p>© {new Date().getFullYear()} Цветочный Рай. Информация на сайте не является публичной офертой.</p>
          </div>
        </div>
      </footer>

      {/* Корзина */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsCartOpen(false)}
            role="presentation"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-[var(--lilar-card)] shadow-2xl border-l border-[var(--lilar-border)]">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-5 border-b border-[var(--lilar-border)]">
                <h3 className="text-lg font-bold text-[var(--lilar-text)] flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-[var(--lilar-primary)]" />
                  Корзина
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 hover:bg-[var(--lilar-bg)] rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-[var(--lilar-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-10 h-10 text-[var(--lilar-primary)]/40" />
                    </div>
                    <h4 className="font-semibold text-[var(--lilar-text)] mb-2">Корзина пуста</h4>
                    <p className="text-sm text-[var(--lilar-muted)] mb-4">Добавьте букет из каталога</p>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="text-[var(--lilar-primary)] font-semibold text-sm hover:underline"
                    >
                      Перейти в каталог →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-3 bg-[var(--lilar-bg)] rounded-xl p-3 border border-[var(--lilar-border)]">
                        <img
                          src={item.image || PRODUCT_IMAGE_PLACEHOLDER}
                          alt={item.name}
                          onError={onProductImageError}
                          className="w-[72px] h-[72px] min-h-[4.5rem] object-cover rounded-lg bg-white"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[var(--lilar-text)] text-sm line-clamp-2">{item.name}</h4>
                          <p className="text-[var(--lilar-primary)] font-bold text-sm">{item.price} ₽</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 bg-white border border-[var(--lilar-border)] rounded-full flex items-center justify-center hover:bg-white/80"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-semibold text-sm w-6 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 bg-white border border-[var(--lilar-border)] rounded-full flex items-center justify-center hover:bg-white/80"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="w-9 h-9 hover:bg-red-50 rounded-full flex items-center justify-center self-start shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-[var(--lilar-border)] bg-[var(--lilar-bg)]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[var(--lilar-muted)]">Итого:</span>
                    <span className="text-xl font-bold text-[var(--lilar-text)]">{cartTotal.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <button
                    type="button"
                    className="w-full bg-[var(--lilar-primary)] text-white py-3.5 rounded-full font-bold text-sm hover:bg-[var(--lilar-primary-hover)] transition-colors shadow-md"
                  >
                    Оформить заказ
                  </button>
                  <p className="text-center text-[var(--lilar-muted)] text-xs mt-3">
                    <Truck className="w-3.5 h-3.5 inline mr-1" />
                    Условия доставки уточняйте у оператора
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
