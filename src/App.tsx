import { useState, useEffect, useMemo, useCallback, type SyntheticEvent } from 'react';
import { ShoppingCart, Heart, Search, Menu, X, Star, Truck, Flower2, Award, Clock, ChevronRight, Phone, Mail, Share2, Users, Plus, Minus, Trash2, RefreshCw } from 'lucide-react';
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
      className="w-14 h-14 rounded-full border-2 border-rose-200 flex items-center justify-center text-sm font-bold text-white shrink-0 bg-gradient-to-br from-rose-400 to-pink-500"
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Flower2 className="w-8 h-8 text-rose-500" />
              <span className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                Цветочный Рай
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#catalog" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">Каталог</a>
              <a href="#about" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">О нас</a>
              <a href="#reviews" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">Отзывы</a>
              <a href="#contacts" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">Контакты</a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-rose-50 rounded-full transition-colors">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-rose-50 rounded-full transition-colors relative">
                <Heart className="w-5 h-5 text-gray-600" />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">
                    {favorites.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsCartOpen(true)}
                className="p-2 hover:bg-rose-50 rounded-full transition-colors relative"
              >
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-rose-50 rounded-full transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <nav className="flex flex-col p-4 gap-4">
              <a href="#catalog" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">Каталог</a>
              <a href="#about" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">О нас</a>
              <a href="#reviews" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">Отзывы</a>
              <a href="#contacts" className="text-gray-700 hover:text-rose-500 transition-colors font-medium">Контакты</a>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-600 px-4 py-2 rounded-full text-sm font-medium">
                <span className="text-xl">🌷</span>
                Доставка за 1 час
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Подарите
                <span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                  {' '}яркие эмоции{' '}
                </span>
                с цветами
              </h1>
              <p className="text-lg text-gray-600">
                Самые свежие цветы для ваших любимых. Собираем уникальные букеты с любовью и заботой.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#catalog"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 transition-all transform hover:-translate-y-1"
                >
                  Выбрать букет
                  <ChevronRight className="w-5 h-5" />
                </a>
                <button className="inline-flex items-center justify-center gap-2 border-2 border-rose-300 text-rose-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-rose-50 transition-all">
                  <Phone className="w-5 h-5" />
                  Заказать звонок
                </button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-rose-500">10+</div>
                  <div className="text-sm text-gray-500">лет на рынке</div>
                </div>
                <div className="w-px h-12 bg-gray-200"></div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-rose-500">5000+</div>
                  <div className="text-sm text-gray-500">довольных клиентов</div>
                </div>
                <div className="w-px h-12 bg-gray-200"></div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-rose-500">4.9</div>
                  <div className="text-sm text-gray-500">рейтинг</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-10 -left-10 w-72 h-72 bg-rose-200 rounded-full blur-3xl opacity-50"></div>
              <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-pink-200 rounded-full blur-3xl opacity-50"></div>
              <img
                src={HERO_IMAGE_URL}
                alt="Красивый букет цветов"
                onError={onHeroImageError}
                className="relative rounded-3xl shadow-2xl w-full max-w-lg mx-auto transform hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Бесплатная доставка</div>
                  <div className="text-sm text-gray-500">от 3000 ₽</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="about" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Почему выбирают нас</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Мы заботимся о каждом клиенте и гарантируем высокое качество</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Flower2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Свежие цветы</h3>
              <p className="text-gray-600">Ежедневные поставки свежих цветов из лучших питомников</p>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Award className="w-8 h-8 text-pink-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Качество</h3>
              <p className="text-gray-600">Каждый букет собирается профессиональными флористами</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Truck className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Быстрая доставка</h3>
              <p className="text-gray-600">Доставим ваш заказ за 1 час по всему городу</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Работаем 24/7</h3>
              <p className="text-gray-600">Всегда готовы помочь с выбором букета в любое время</p>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="catalog" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 max-w-5xl mx-auto text-center sm:text-left">
            <div className="sm:flex-1">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Хит продаж</h2>
              <p className="text-gray-600 max-w-2xl mx-auto sm:mx-0">Самые популярные букеты этого сезона</p>
            </div>
            <button
              type="button"
              onClick={() => void syncFromMoysklad()}
              disabled={productsLoading}
              className="inline-flex items-center justify-center gap-2 self-center sm:self-auto px-5 py-2.5 rounded-full border-2 border-rose-200 bg-white text-rose-600 font-medium hover:bg-rose-50 hover:border-rose-300 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <RefreshCw className={`w-5 h-5 ${productsLoading ? 'animate-spin' : ''}`} aria-hidden />
              Синхронизировать МойСклад → БД
            </button>
          </div>

          {/* Search & Filter */}
          <div className="mb-8 space-y-6">
            {/* Search */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск букета..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-full focus:border-rose-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  title={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`max-w-[min(100%,20rem)] px-4 py-3 rounded-full font-medium transition-all text-left ${
                    selectedCategory === category.name
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-200'
                      : 'bg-white text-gray-700 hover:bg-rose-50 border border-gray-200'
                  }`}
                >
                  <span className="mr-2">{category.icon}</span>
                  <span className="align-middle line-clamp-2 break-words">{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {productsLoading && (
            <p className="text-center text-gray-600 py-12">Загрузка каталога из базы…</p>
          )}
          {productsError && (
            <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {productsError}
            </div>
          )}
          {!productsLoading && !productsError && filteredProducts.length === 0 && (
            <p className="text-center text-gray-500 py-12">Нет товаров по выбранным условиям.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={product.image || PRODUCT_IMAGE_PLACEHOLDER}
                    alt={product.name}
                    onError={onProductImageError}
                    decoding="async"
                    className="w-full h-64 min-h-[16rem] object-cover object-center bg-rose-50 group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  <button
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites.includes(product.id)
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                  {product.oldPrice && product.oldPrice > product.price && (
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {product.rating > 0 ? (
                      <>
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium text-gray-600">{product.rating}</span>
                      </>
                    ) : null}
                    <span className="text-xs text-gray-400 ml-1">({product.category})</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{product.name}</h3>
                  <div className="text-xs text-gray-500 space-y-0.5 mb-2">
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
                  <p className="text-sm text-gray-500 mb-3 line-clamp-3">{product.description}</p>
                  {product.salePricesLabels.length > 0 && (
                    <ul className="text-xs text-gray-600 mb-3 space-y-0.5">
                      {product.salePricesLabels.map((sp, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>{sp.label}</span>
                          <span className="font-medium">{sp.rub.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-2xl font-bold text-rose-500">
                        {product.price > 0
                          ? `${product.price.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`
                          : '—'}
                      </span>
                      {product.oldPrice != null && product.oldPrice > product.price && (
                        <span className="text-sm text-gray-400 line-through ml-2">
                          {product.oldPrice.toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={product.price <= 0}
                      onClick={() => addToCart(product)}
                      className="w-12 h-12 shrink-0 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-rose-200 transition-all transform hover:scale-110 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-16 bg-gradient-to-br from-rose-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Отзывы клиентов</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Что говорят о нас наши покупатели</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-6">
                  <ReviewAvatar name={review.name} />
                  <div>
                    <div className="font-bold text-gray-900">{review.name}</div>
                    <div className="text-sm text-gray-500">{review.date}</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-3xl p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute top-10 left-10 text-9xl">🌸</div>
              <div className="absolute bottom-10 right-10 text-9xl">🌷</div>
              <div className="absolute top-1/2 left-1/4 text-7xl">🌺</div>
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
                Готовы порадовать близких?
              </h2>
              <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
                Закажите букет прямо сейчас и получите скидку 15% на первый заказ!
              </p>
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 bg-white text-rose-500 px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
              >
                Заказать букет
                <ChevronRight className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacts" className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Flower2 className="w-8 h-8 text-rose-400" />
                <span className="text-2xl font-bold">Цветочный Рай</span>
              </div>
              <p className="text-gray-400 mb-6">
                Ваш надежный партнер в мире цветов. Доставляем радость каждый день!
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-rose-500 rounded-full flex items-center justify-center transition-colors">
                  <Share2 className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 hover:bg-rose-500 rounded-full flex items-center justify-center transition-colors">
                  <Users className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6">Навигация</h3>
              <ul className="space-y-3">
                <li><a href="#catalog" className="text-gray-400 hover:text-rose-400 transition-colors">Каталог</a></li>
                <li><a href="#about" className="text-gray-400 hover:text-rose-400 transition-colors">О нас</a></li>
                <li><a href="#reviews" className="text-gray-400 hover:text-rose-400 transition-colors">Отзывы</a></li>
                <li><a href="#" className="text-gray-400 hover:text-rose-400 transition-colors">Доставка и оплата</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6">Каталог</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-400 hover:text-rose-400 transition-colors">Розы</a></li>
                <li><a href="#" className="text-gray-400 hover:text-rose-400 transition-colors">Пионы</a></li>
                <li><a href="#" className="text-gray-400 hover:text-rose-400 transition-colors">Хризантемы</a></li>
                <li><a href="#" className="text-gray-400 hover:text-rose-400 transition-colors">Композиции</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6">Контакты</h3>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400">
                  <Phone className="w-5 h-5 text-rose-400" />
                  +7 (999) 123-45-67
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <Mail className="w-5 h-5 text-rose-400" />
                  info@flowers.ru
                </li>
                <li className="text-gray-400">
                  📍 Москва, ул. Цветочная, д. 1
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500">
            <p>© 2024 Цветочный Рай. Все права защищены.</p>
          </div>
        </div>
      </footer>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsCartOpen(false)}
          ></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-rose-500" />
                  Корзина
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-6">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingCart className="w-12 h-12 text-rose-300" />
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">Корзина пуста</h4>
                    <p className="text-gray-500 mb-6">Добавьте красивые цветы в корзину</p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="text-rose-500 font-medium hover:text-rose-600"
                    >
                      Перейти в каталог →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-4 bg-gray-50 rounded-2xl p-4">
                        <img
                          src={item.image || PRODUCT_IMAGE_PLACEHOLDER}
                          alt={item.name}
                          onError={onProductImageError}
                          className="w-20 h-20 min-h-[5rem] object-cover rounded-xl bg-rose-50"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{item.name}</h4>
                          <p className="text-rose-500 font-bold">{item.price} ₽</p>
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:bg-gray-100 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:bg-gray-100 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-10 h-10 hover:bg-red-50 rounded-full flex items-center justify-center self-start transition-colors"
                        >
                          <Trash2 className="w-5 h-5 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="p-6 border-t bg-gray-50">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-600">Итого:</span>
                    <span className="text-2xl font-bold text-rose-500">{cartTotal} ₽</span>
                  </div>
                  <button className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                    Оформить заказ
                  </button>
                  <p className="text-center text-gray-500 text-sm mt-4">
                    <Truck className="w-4 h-4 inline mr-1" />
                    Бесплатная доставка от 3000 ₽
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
