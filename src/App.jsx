import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

export default function GemaserVarillaApp() {
  const APP_NAME = "GEMASER";
  const APP_URL =
    typeof window !== "undefined"
      ? window.location.href
      : "https://gemaser-varilla.vercel.app";
  const DEST_EMAIL = "drjorgealejandro@hotmail.com";
  const DEST_WHATSAPP = "528441892008";
  const LOGO_URL = "/logo-gemaser.png";
  const FALLBACK_PRICE = 18500;

  const products = [
    {
      id: 1,
      calibre: '3/8”',
      descripcion: "Varilla corrugada 3/8",
      image: "/calibres/3-8.png",
      tag: "Uso ligero",
      color: "from-violet-500/15 to-violet-500/5",
      badgeColor: "bg-violet-600",
      featured: false,
    },
    {
      id: 2,
      calibre: '1/2”',
      descripcion: "Varilla corrugada 1/2",
      image: "/calibres/1-2.png",
      tag: "Alta rotación",
      color: "from-blue-500/15 to-blue-500/5",
      badgeColor: "bg-blue-600",
      featured: true,
    },
    {
      id: 3,
      calibre: '5/8”',
      descripcion: "Varilla corrugada 5/8",
      image: "/calibres/5-8.png",
      tag: "Obra estructural",
      color: "from-emerald-500/15 to-emerald-500/5",
      badgeColor: "bg-emerald-600",
      featured: false,
    },
    {
      id: 4,
      calibre: '3/4”',
      descripcion: "Varilla corrugada 3/4",
      image: "/calibres/3-4.png",
      tag: "Mayor calibre",
      color: "from-orange-500/15 to-orange-500/5",
      badgeColor: "bg-orange-600",
      featured: false,
    },
  ];

  const [showSplash, setShowSplash] = useState(true);
  const [precioTonelada, setPrecioTonelada] = useState(FALLBACK_PRICE);
  const [lastUpdated, setLastUpdated] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [quantities, setQuantities] = useState(
    Object.fromEntries(products.map((p) => [p.id, ""]))
  );
  const [installPrompt, setInstallPrompt] = useState(null);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1400);

    return () => clearTimeout(timer);
  }, []);

  const cargarPrecioRemoto = async () => {
    try {
      setPriceLoading(true);
      setPriceError("");

      const { data, error } = await supabase
        .from("configuracion_precios")
        .select("precio_tonelada, actualizado")
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const nextPrice = Number(data?.precio_tonelada);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        throw new Error("El precio remoto no es válido.");
      }

      setPrecioTonelada(nextPrice);
     console.log("actualizado desde supabase:", data?.actualizado);
     setLastUpdated(data?.actualizado || new Date().toISOString());
    } catch (error) {
      console.error("Error Supabase:", error);
      setPriceError(`Error remoto: ${error?.message || "desconocido"}`);
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    cargarPrecioRemoto();
  }, []);

  const seguro = useMemo(() => precioTonelada * 0.0020, [precioTonelada]);

  const subtotalTon = useMemo(
    () => precioTonelada + seguro,
    [precioTonelada, seguro]
  );

  const precioFinalTon = useMemo(() => subtotalTon * 1.16, [subtotalTon]);

  const items = useMemo(() => {
    return products.map((p) => {
      const toneladas = Number(quantities[p.id] || 0);
      const total = toneladas * precioFinalTon;
      return { ...p, toneladas, total };
    });
  }, [quantities, precioFinalTon]);

  const totalToneladas = useMemo(
    () => items.reduce((acc, item) => acc + item.toneladas, 0),
    [items]
  );

  const totalPedido = useMemo(
    () => items.reduce((acc, item) => acc + item.total, 0),
    [items]
  );

  const totalPiezas = useMemo(
    () => items.filter((item) => item.toneladas > 0).length,
    [items]
  );

  const handleQtyChange = (id, value) => {
    if (value === "") {
      setQuantities((prev) => ({ ...prev, [id]: "" }));
      return;
    }

    const normalized = value.replace(",", ".");
    if (!/^\d*\.?\d*$/.test(normalized)) return;

    setQuantities((prev) => ({ ...prev, [id]: normalized }));
  };

  const changeQty = (id, delta) => {
    const current = Number(quantities[id] || 0);
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);

    setQuantities((prev) => ({
      ...prev,
      [id]: next === 0 ? "" : String(next),
    }));
  };

  const setQuickQty = (id, value) => {
    setQuantities((prev) => ({ ...prev, [id]: String(value) }));
  };

  const selectedItems = items.filter((i) => i.toneladas > 0);

  const pedidoResumen = useMemo(() => {
    const lines = selectedItems.length
      ? selectedItems.map(
          (i) =>
            `• ${i.descripcion} (${i.calibre}): ${formatNumber(
              i.toneladas
            )} ton = ${money(i.total)}`
        )
      : ["• Sin productos seleccionados"];

    return [
      "NUEVO PEDIDO - GEMASER",
      "",
      `Precio base por tonelada: ${money(precioTonelada)}`,
      `Seguro 0.20%: ${money(seguro)}`,
      `Precio con seguro: ${money(subtotalTon)}`,
      `Precio final con IVA 16%: ${money(precioFinalTon)}`,
      "",
      "Detalle del pedido:",
      ...lines,
      "",
      `Total de toneladas: ${formatNumber(totalToneladas)}`,
      `Total del pedido: ${money(totalPedido)}`,
    ].join("\n");
  }, [
    selectedItems,
    precioTonelada,
    seguro,
    subtotalTon,
    precioFinalTon,
    totalToneladas,
    totalPedido,
  ]);

  const enviarPorCorreo = () => {
    const subject = encodeURIComponent("Nuevo pedido de varilla - GEMASER");
    const body = encodeURIComponent(pedidoResumen);
    window.location.href = `mailto:${DEST_EMAIL}?subject=${subject}&body=${body}`;
  };

  const enviarPorWhatsApp = () => {
    const text = encodeURIComponent(pedidoResumen);
    window.open(`https://wa.me/${DEST_WHATSAPP}?text=${text}`, "_blank");
  };

  const compartirCatalogo = async () => {
    const shareData = {
      title: "GEMASER - Catálogo de varilla",
      text: "Consulta precios de varilla y haz tu pedido rápido en GEMASER.",
      url: APP_URL,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Catálogo compartido.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(APP_URL);
        setShareStatus("Se copió el enlace del catálogo.");
      } else {
        setShareStatus(
          "Tu navegador no permite compartir directamente en esta vista."
        );
      }
    } catch {
      setShareStatus("No se completó el compartir.");
    }
  };

  const instalarApp = async () => {
    if (!installPrompt) {
      setShareStatus(
        "Si no aparece la instalación automática, usa el menú del navegador y selecciona 'Agregar a pantalla de inicio'."
      );
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const limpiarPedido = () => {
    setQuantities(Object.fromEntries(products.map((p) => [p.id, ""])));
  };

  if (showSplash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f2]">
        <div className="flex flex-col items-center gap-4">
          <img
            src={LOGO_URL}
            alt="GEMASER"
            className="w-40 h-40 object-contain"
          />
          <div className="text-3xl font-black tracking-tight text-[#5f6830]">
            GEMASER
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f6f2_0%,#eef1e8_100%)] text-slate-900 pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-8 space-y-6">
        <div className="sticky top-0 z-50 rounded-2xl border border-[#d8debf] bg-white/95 backdrop-blur px-4 py-3 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
              Precio del día
            </div>
            <div className="text-xl font-black text-[#5f6830]">
              {money(precioTonelada)}
            </div>
            {lastUpdated ? (
              <div className="text-xs text-slate-500">
                Actualizado: {formatDate(lastUpdated)}
              </div>
            ) : null}
          </div>

          <button
            onClick={cargarPrecioRemoto}
            className="w-full sm:w-auto rounded-2xl px-5 py-3 font-bold bg-[#7a8442] text-white shadow-lg hover:opacity-90 transition"
          >
            {priceLoading ? "Actualizando precio..." : "Actualizar precio ahora"}
          </button>
        </div>

        <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(122,132,66,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.08),transparent_30%)]" />
          <div className="relative p-5 md:p-8">
            <div className="w-full">
              <div className="relative rounded-[28px] overflow-hidden border border-[#e2e7d3] bg-white p-6 md:p-8 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.2)]">
                <div className="flex flex-col items-center justify-center text-center gap-4">
                  <img
                    src={LOGO_URL}
                    alt="Logo GEMASER"
                    className="h-24 md:h-32 w-auto object-contain mx-auto"
                  />

                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#5f6830]">
                    {APP_NAME}
                  </h1>

                  <button
                    onClick={cargarPrecioRemoto}
                    className="rounded-2xl px-6 py-3 font-bold bg-[#7a8442] text-white shadow-lg hover:scale-105 transition"
                  >
                    {priceLoading ? "Actualizando precio..." : "Actualizar precio"}
                  </button>

                  {lastUpdated ? (
                    <div className="text-xs text-slate-500">
                      Última actualización: {formatDate(lastUpdated)}
                    </div>
                  ) : null}

                  {priceError ? (
                    <div className="text-xs text-amber-700">{priceError}</div>
                  ) : null}

                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <button
                      onClick={instalarApp}
                      className="rounded-2xl px-6 py-3 font-semibold bg-[#7a8442] text-white shadow-lg hover:scale-105 transition"
                    >
                      Instalar app
                    </button>

                    <button
                      onClick={compartirCatalogo}
                      className="rounded-2xl px-6 py-3 font-semibold border border-[#7a8442] text-[#5f6830] hover:bg-[#f7f8f2] transition"
                    >
                      Compartir
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <TopMetric title="Precio final ton" value={money(precioFinalTon)} />
              <TopMetric title="Toneladas" value={formatNumber(totalToneladas)} />
              <TopMetric title="Productos" value={String(totalPiezas)} />
              <TopMetric title="Pedido" value={money(totalPedido)} />
            </div>

            {shareStatus ? (
              <p className="mt-4 text-sm text-slate-600">{shareStatus}</p>
            ) : null}
          </div>
        </section>

        <div className="grid xl:grid-cols-[1.45fr_0.9fr] gap-6 items-start">
          <section className="space-y-5">
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 md:p-6 shadow-[0_15px_50px_-30px_rgba(15,23,42,0.35)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Configuración de precio
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Modifica el precio base y el cálculo se actualizará en todo
                    el catálogo.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid md:grid-cols-4 gap-4">
                <Field label="Precio base por tonelada">
                  <div className="space-y-2">
                    <input
                      type="number"
                      readOnly
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-lg font-semibold outline-none"
                      value={precioTonelada}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={cargarPrecioRemoto}
                        className="rounded-xl bg-[#7a8442] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                      >
                        {priceLoading ? "Actualizando..." : "Actualizar precio"}
                      </button>
                      {lastUpdated ? (
                        <span className="text-xs text-slate-500">
                          Última actualización: {formatDate(lastUpdated)}
                        </span>
                      ) : null}
                    </div>
                    {priceError ? (
                      <div className="text-xs text-amber-700">{priceError}</div>
                    ) : null}
                  </div>
                </Field>

                <Stat title="Seguro 0.15%" value={money(seguro)} />
                <Stat title="Subtotal + seguro" value={money(subtotalTon)} />
                <Stat
                  title="Precio final + IVA"
                  value={money(precioFinalTon)}
                  highlight
                />
              </div>
            </div>

            <div className="space-y-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_15px_50px_-32px_rgba(15,23,42,0.35)]"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${item.color}`} />
                  <div className="p-4 md:p-5 lg:p-6">
                    <div className="grid md:grid-cols-[220px_1fr_240px] gap-5 items-center">
                      <div
                        className={`relative rounded-[24px] border border-slate-200 bg-gradient-to-br ${item.color} p-3`}
                      >
                        {item.featured ? (
                          <div className="absolute left-5 top-5 z-10 rounded-full bg-[#7a8442] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg">
                            Más vendido
                          </div>
                        ) : null}

                        <div
                          className={`absolute bottom-5 right-5 z-10 rounded-2xl ${item.badgeColor} px-4 py-2 text-lg font-black text-white shadow-xl`}
                        >
                          {item.calibre}
                        </div>

                        <img
                          src={item.image}
                          alt={item.descripcion}
                          className="w-full h-44 object-cover object-bottom-right rounded-2xl bg-white"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                            {item.calibre}
                          </span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            {item.tag}
                          </span>
                          {item.featured ? (
                            <span className="inline-flex rounded-full border border-[#cbd3af] bg-[#f7f8f2] px-3 py-1 text-xs font-semibold text-[#5f6830]">
                              Recomendado
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h3 className="text-2xl font-bold text-slate-900">
                            {item.descripcion}
                          </h3>
                          <p className="text-slate-500 mt-1">
                            Precio calculado automáticamente por tonelada.
                          </p>
                        </div>

                        <div className="grid sm:grid-cols-1 gap-3">
                          <InfoChip
                            label="Importe actual"
                            value={money(item.total)}
                          />
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-slate-600 block mb-2">
                            Cantidad (toneladas)
                          </label>
                          <div className="flex items-center rounded-2xl border border-slate-300 bg-white overflow-hidden">
                            <button
                              onClick={() => changeQty(item.id, -1)}
                              className="px-4 py-3 text-2xl font-black text-slate-900 bg-white hover:bg-slate-100 transition"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full text-center px-3 py-3 outline-none text-lg font-semibold"
                              value={quantities[item.id]}
                              onChange={(e) =>
                                handleQtyChange(item.id, e.target.value)
                              }
                              placeholder="0"
                            />
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              className="px-4 py-3 text-2xl font-black text-slate-900 bg-white hover:bg-slate-100 transition"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">
                            Accesos rápidos
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[1, 2, 4, 10].map((quick) => (
                              <button
                                key={quick}
                                onClick={() => setQuickQty(item.id, quick)}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                              >
                                {quick} ton
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => changeQty(item.id, 1)}
                            className="rounded-2xl bg-[#7a8442] px-3 py-3 text-sm font-bold text-white shadow-lg shadow-[#7a8442]/20 hover:opacity-90 transition"
                          >
                            Agregar 1 ton
                          </button>
                          <button
                            onClick={() => changeQty(item.id, 2)}
                            className="rounded-2xl border border-[#cbd3af] bg-white px-3 py-3 text-sm font-bold text-[#5f6830] hover:bg-[#f7f8f2] transition"
                          >
                            Agregar 2 ton
                          </button>
                        </div>

                        <div className="rounded-2xl bg-white p-3 border border-slate-200">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                            Subtotal producto
                          </div>
                          <div className="mt-1 text-2xl font-black text-[#5f6830]">
                            {money(item.total)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="xl:sticky xl:top-6 space-y-5">
            <section className="rounded-[28px] overflow-hidden bg-slate-950 text-white shadow-[0_20px_70px_-30px_rgba(15,23,42,0.85)]">
              <div className="bg-[linear-gradient(90deg,rgba(122,132,66,0.9),rgba(122,132,66,0.55))] px-5 py-4">
                <h2 className="text-2xl font-bold">Resumen del pedido</h2>
                <p className="text-sm text-white/85 mt-1">
                  Listo para enviar a tu correo o directo por WhatsApp.
                </p>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    title="Toneladas"
                    value={formatNumber(totalToneladas)}
                  />
                  <MiniStat title="Total" value={money(totalPedido)} />
                </div>

                <div className="rounded-3xl bg-white/10 p-4 space-y-3">
                  <Row title="Base por tonelada" value={money(precioTonelada)} />
                  <Row title="Seguro 0.15%" value={money(seguro)} />
                  <Row title="Con seguro" value={money(subtotalTon)} />
                  <div className="h-px bg-white/10" />
                  <Row
                    title="Final con IVA"
                    value={money(precioFinalTon)}
                    strong
                  />
                </div>

                <div className="rounded-3xl bg-white/10 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 mb-3">
                    Productos seleccionados
                  </div>
                  {selectedItems.length ? (
                    <div className="space-y-3 max-h-64 overflow-auto pr-1">
                      {selectedItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl bg-white/10 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{item.calibre}</div>
                              <div className="text-sm text-slate-300">
                                {formatNumber(item.toneladas)} ton
                              </div>
                            </div>
                            <div className="text-right font-bold">
                              {money(item.total)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                      Aún no has agregado toneladas. Elige un calibre y captura
                      la cantidad para generar el pedido.
                    </div>
                  )}
                </div>

                <div className="rounded-3xl bg-white/10 p-4 text-sm leading-6 whitespace-pre-line text-slate-200">
                  {pedidoResumen}
                </div>

                <div className="grid gap-3">
                  <button
                    onClick={enviarPorWhatsApp}
                    className="rounded-2xl bg-[#7a8442] text-white px-4 py-4 font-bold text-base shadow-lg shadow-[#7a8442]/20 hover:opacity-90 transition"
                  >
                    Cerrar pedido ahora
                  </button>
                  <button
                    onClick={enviarPorWhatsApp}
                    className="rounded-2xl bg-emerald-500 text-white px-4 py-3.5 font-semibold hover:opacity-90 transition"
                  >
                    Enviar pedido por WhatsApp
                  </button>
                  <button
                    onClick={enviarPorCorreo}
                    className="rounded-2xl bg-white text-slate-900 px-4 py-3.5 font-semibold hover:opacity-90 transition"
                  >
                    Enviar pedido por correo
                  </button>
                  <button
                    onClick={limpiarPedido}
                    className="rounded-2xl border border-white/15 px-4 py-3.5 font-semibold hover:bg-white/10 transition"
                  >
                    Limpiar pedido
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_15px_50px_-32px_rgba(15,23,42,0.35)]">
              <h3 className="text-lg font-bold text-slate-900">
                Contacto fijo de recepción
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600 leading-6">
                <div>
                  <strong className="text-slate-900">Correo:</strong>{" "}
                  {DEST_EMAIL}
                </div>
                <div>
                  <strong className="text-slate-900">WhatsApp:</strong>{" "}
                  8441892008
                </div>
                <p className="pt-2">
                  El cliente solo consulta, captura toneladas y presiona enviar.
                  No necesita escribir tus datos ni hacer cálculos manuales.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pedido actual
            </div>
            <div className="text-lg font-black text-slate-900">
              {money(totalPedido)}
            </div>
            <div className="text-xs text-slate-500">
              {formatNumber(totalToneladas)} ton
            </div>
          </div>
          <button
            onClick={enviarPorWhatsApp}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg"
          >
            Pedir por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600 block mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ title, value, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-[#cbd3af] bg-[#f7f8f2]"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="text-sm text-slate-500">{title}</div>
      <div
        className={`text-xl font-bold mt-1 ${
          highlight ? "text-[#5f6830]" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({ title, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <div className="text-sm text-slate-300">{title}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

function TopMetric({ title, value }) {
  return (
    <div className="rounded-2xl border border-[#e2e7d3] bg-[#f8f9f4] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
        {title}
      </div>
      <div className="mt-1 text-lg md:text-xl font-black text-slate-900">
        {value}
      </div>
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 font-semibold">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Row({ title, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div
        className={`text-sm ${
          strong ? "font-semibold text-white" : "text-slate-300"
        }`}
      >
        {title}
      </div>
      <div
        className={`${
          strong ? "text-xl font-black text-white" : "font-semibold text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  console.log("valor recibido en formatDate:", value);
  const date = new Date(value);
  console.log("date interpretada:", date.toString());

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Monterrey",
  }).format(date);
}