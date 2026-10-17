import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ProductCard from '../components/ProductCard'
import { fetchProducts } from '../lib/api'
import type { Product } from '../types/db'

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([])
  useEffect(() => {
    fetchProducts({ featured: true }).then(setFeatured).catch(() => undefined)
  }, [])

  return (
    <>
      <Helmet><title>Algase | Estampados, confecciones y bordados</title></Helmet>
      <section aria-label="Colección Algase" className="home-hero">
        <img src="/images/portada-inicio.png" alt="Taller y técnicas de estampado Algase" className="home-hero__image" fetchPriority="high" />
        <div aria-hidden="true" className="home-hero__overlay" />
        <div className="home-hero__content">
          <h1 className="home-hero__title">¿Tienes una idea?<br /><span className="text-brand">La estampamos</span></h1>
          <div className="home-hero__actions">
            <Link to="/catalogo" className="btn btn--primary">IR AL CATÁLOGO</Link>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="home-section" aria-labelledby="feat">
          <div className="section-heading"><h2 id="feat" className="section-heading__title">Elegidos para ti</h2><Link to="/catalogo" className="section-heading__link">Ver todos</Link></div>
          <div className="featured-grid">{featured.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}

      <section className="steps-section steps-section--banner" aria-labelledby="how">
        <div className="steps-section__intro"><p className="eyebrow">Compra simple</p><h2 id="how" className="steps-section__title">De la idea a tu diseño</h2></div>
        <ol className="steps-list">
          <li className="step-item"><span className="step-item__num">01</span><h3 className="step-item__title">Elige el producto</h3><p className="step-item__text">Revisa formato, talla, color y precio de referencia.</p></li>
          <li className="step-item"><span className="step-item__num">02</span><h3 className="step-item__title">Prepara tu diseño</h3><p className="step-item__text">Carga una imagen y ubícala en la vista previa.</p></li>
          <li className="step-item"><span className="step-item__num">03</span><h3 className="step-item__title">Confirma con Algase</h3><p className="step-item__text">Disponibilidad, costo final, entrega y pago se coordinan directamente.</p></li>
        </ol>
      </section>

      <section className="cta-strip">
        <div><h2 className="cta-strip__title">¿Necesitas varias unidades o un diseño especial?</h2><p className="cta-strip__text">Conversemos para preparar una cotización a tu medida.</p></div>
        <Link to="/contacto" className="btn btn--ghost">Solicitar orientación</Link>
      </section>
    </>
  )
}
