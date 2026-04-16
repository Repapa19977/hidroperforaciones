-- seed-prod.sql — PostgreSQL
-- ON CONFLICT DO NOTHING para que sea idempotente (seguro re-ejecutar)

INSERT INTO "Cotizacion" (id,correlativo,cliente,empresa,proyecto,tipo,estado,monto,fecha,vendedor,datos,"createdAt","updatedAt")
VALUES (
  'cmo00jegj0005lkuuvh9jnbe8','HP-COT-0112','Ramon Perez','Remate sa',
  'Perforación de pozo mecánico','perforacion','borrador',825608.0000000001,
  '15/4/2026','René Domínguez',
  $d${"correlativo":"HP-COT-0112","tipo":"perforacion","fecha":"15/4/2026","validezDias":15,"cliente":"Ramon Perez","empresa":"Remate sa","nit":"222222222222222222222","telefono":"+50258895092","proyecto":"Perforación de pozo mecánico","direccion":"KILOMETRO 16.5 CASA 48 CAMPO GRANDE CARRETERA A DON JUSTO","duracion":"1 mes","vendedor":"René Domínguez","ip":{"diametro":12,"profundidad":750,"numeroDeTubos":30,"numeroDeFilteros":8,"precioPorPieVenta":700,"costoPorTubo":2567,"costoPorFiltro":950,"rendimientoPorDia":20,"diasExtra":3,"costomaquinariaDia":4000,"costoDieselDia":2000,"bonificacionPorPie":13,"personalPerforacion":3,"salarioMensual":4500,"viaticosDia":25,"turnosDia":3,"hospedajeNoche":100,"nochesHospedaje":30,"kilometros":100,"precioDieselTraslado":28,"diasTraslado":2,"personalTraslado":7,"precioBentonitaSaco":157,"costoGravaTotalQ":9000,"costoAforoBase":7931,"horasAforo":24,"comisionVendedorPct":1,"incluirLimpieza":true,"costoBomba":27500},"condiciones":"1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.\n2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.\n3. Forma de pago: 50% anticipo para iniciar trabajos, 50% contra entrega del informe final.\n4. El cliente deberá proporcionar acceso libre al sitio de perforación y energía eléctrica disponible.\n5. En caso de encontrarse roca o material duro no previsto, se acordará un ajuste de precio.\n6. El tiempo de ejecución puede variar según condiciones geológicas del terreno.\n7. El presente presupuesto no incluye permisos municipales ni licencias de perforación.","notas":"Hola mundo 1"}$d$,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "Cotizacion" (id,correlativo,cliente,empresa,proyecto,tipo,estado,monto,fecha,vendedor,datos,"createdAt","updatedAt")
VALUES (
  'cmo00lg5g0007lkuu7v528s8z','HP-COT-0116','Manuel Dominguez','Olmeca',
  'Perforación de pozo mecánico','perforacion','confirmada',785130.0800000001,
  '15/4/2026','Gilda García',
  $d${"correlativo":"HP-COT-0116","tipo":"perforacion","fecha":"15/4/2026","validezDias":15,"cliente":"Manuel Dominguez","empresa":"Olmeca","nit":"2222222222222222222","telefono":"+50258895092","proyecto":"Perforación de pozo mecánico","direccion":"KILOMETRO 16.5 CASA 48 CAMPO GRANDE CARRETERA A DON JUSTO","duracion":"1 mes","vendedor":"Gilda García","ip":{"diametro":7,"profundidad":702,"numeroDeTubos":30,"numeroDeFilteros":8,"precioPorPieVenta":700,"costoPorTubo":2522,"costoPorFiltro":950,"rendimientoPorDia":20,"diasExtra":3,"costomaquinariaDia":4000,"costoDieselDia":2000,"bonificacionPorPie":13,"personalPerforacion":3,"salarioMensual":4500,"viaticosDia":25,"turnosDia":3,"hospedajeNoche":100,"nochesHospedaje":30,"kilometros":100,"precioDieselTraslado":28,"diasTraslado":2,"personalTraslado":7,"precioBentonitaSaco":157,"costoGravaTotalQ":9000,"costoAforoBase":7931,"horasAforo":24,"comisionVendedorPct":1,"incluirLimpieza":true,"costoBomba":27500},"condiciones":"1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.\n2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.\n3. Forma de pago: 50% anticipo para iniciar trabajos, 50% contra entrega del informe final.\n4. El cliente deberá proporcionar acceso libre al sitio de perforación y energía eléctrica disponible.\n5. En caso de encontrarse roca o material duro no previsto, se acordará un ajuste de precio.\n6. El tiempo de ejecución puede variar según condiciones geológicas del terreno.\n7. El presente presupuesto no incluye permisos municipales ni licencias de perforación.","notas":"hola mundo 2 "}$d$,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "Cotizacion" (id,correlativo,cliente,empresa,proyecto,tipo,estado,monto,fecha,vendedor,datos,"createdAt","updatedAt")
VALUES (
  'cmo00miqq0009lkuuh0ss7593','HP-COT-0118','Rodrigo Flores','Neurolabs',
  'Perforación de pozo mecánico','limpieza','enviada',37190.72,
  '15/4/2026','Mario Ramírez',
  $d${"correlativo":"HP-COT-0118","tipo":"limpieza","fecha":"15/4/2026","validezDias":15,"cliente":"Rodrigo Flores","empresa":"Neurolabs","nit":"2988888888855555","telefono":"+50258895092","proyecto":"Perforación de pozo mecánico","direccion":"KILOMETRO 16.5 CASA 48 CAMPO GRANDE CARRETERA A DON JUSTO","duracion":"1 mes","vendedor":"Mario Ramírez","il":{"horasLimpieza":40,"horasDia":10,"precioVentaHora":375,"kilometros":100,"precioDiesel":41,"personal":2,"diasTrabajo":4,"viaticosDiarios":25,"hospedajeDiario":100,"salarioMensual":4500,"precioQuimicoCaneca":700,"canecasQuimicos":2},"condiciones":"1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.\n2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.\n3. Forma de pago: 50% anticipo para iniciar trabajos, 50% contra entrega del informe final.\n4. El cliente deberá proporcionar acceso libre al sitio de perforación y energía eléctrica disponible.\n5. En caso de encontrarse roca o material duro no previsto, se acordará un ajuste de precio.\n6. El tiempo de ejecución puede variar según condiciones geológicas del terreno.\n7. El presente presupuesto no incluye permisos municipales ni licencias de perforación.","notas":""}$d$,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "Cotizacion" (id,correlativo,cliente,empresa,proyecto,tipo,estado,monto,fecha,vendedor,datos,"createdAt","updatedAt")
VALUES (
  'cmo00nmwu000clkuungw9vh6r','HP-COT-0120','Mario Perez','Prea',
  'Perforación de pozo mecánico','perforacion','enviada',467055.68,
  '15/4/2026','Carlos Solís',
  $d${"correlativo":"HP-COT-0120","tipo":"perforacion","fecha":"15/4/2026","validezDias":15,"cliente":"Mario Perez","empresa":"Prea","nit":"42342342342342","telefono":"+50258895092","proyecto":"Perforación de pozo mecánico","direccion":"KILOMETRO 16.5 CASA 48 CAMPO GRANDE CARRETERA A DON JUSTO","duracion":"1 mes","vendedor":"Carlos Solís","ip":{"diametro":12,"profundidad":300,"numeroDeTubos":30,"numeroDeFilteros":8,"precioPorPieVenta":700,"costoPorTubo":2567,"costoPorFiltro":950,"rendimientoPorDia":20,"diasExtra":3,"costomaquinariaDia":4000,"costoDieselDia":2000,"bonificacionPorPie":13,"personalPerforacion":3,"salarioMensual":4500,"viaticosDia":25,"turnosDia":3,"hospedajeNoche":100,"nochesHospedaje":30,"kilometros":100,"precioDieselTraslado":28,"diasTraslado":2,"personalTraslado":7,"precioBentonitaSaco":157,"costoGravaTotalQ":9000,"costoAforoBase":7931,"horasAforo":24,"comisionVendedorPct":1,"incluirLimpieza":true,"costoBomba":27500},"condiciones":"1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.\n2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.\n3. Forma de pago: 50% anticipo para iniciar trabajos, 50% contra entrega del informe final.\n4. El cliente deberá proporcionar acceso libre al sitio de perforación y energía eléctrica disponible.\n5. En caso de encontrarse roca o material duro no previsto, se acordará un ajuste de precio.\n6. El tiempo de ejecución puede variar según condiciones geológicas del terreno.\n7. El presente presupuesto no incluye permisos municipales ni licencias de perforación.","notas":"hola mundo 4\n"}$d$,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "Contacto" (id,nombre,empresa,telefono,email,tipo,pais,notas,vendedor,"createdAt","updatedAt")
VALUES ('cmo00jegs0006lkuuvcaf61m1','Ramon Perez','Remate sa','+50258895092','','cliente','Guatemala','','René Domínguez',NOW(),NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Contacto" (id,nombre,empresa,telefono,email,tipo,pais,notas,vendedor,"createdAt","updatedAt")
VALUES ('cmo00lg5o0008lkuui6cmbec5','Manuel Dominguez','Olmeca','+50258895092','','cliente','Guatemala','','Gilda García',NOW(),NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Contacto" (id,nombre,empresa,telefono,email,tipo,pais,notas,vendedor,"createdAt","updatedAt")
VALUES ('cmo00miqz000alkuupgjuybfi','Rodrigo Flores','Neurolabs','+50258895092','','cliente','Guatemala','','Mario Ramírez',NOW(),NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Contacto" (id,nombre,empresa,telefono,email,tipo,pais,notas,vendedor,"createdAt","updatedAt")
VALUES ('cmo00nmx2000dlkuupxvkgadj','Mario Perez','Prea','+50258895092','','cliente','Guatemala','','Carlos Solís',NOW(),NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Usuario" (id,username,nombre,rol,"passwordHash",activo,"createdAt","updatedAt")
VALUES ('43ffb34a-9f1c-492f-b011-c84e90433a9d','superadmin','Super Administrador','superadmin','5a001efc7da964d99701fd2c829f4163c239c9e77b864e6ac556b10e0c4c9525',true,'2026-04-15T13:10:49.026Z','2026-04-15T13:10:49.026Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Usuario" (id,username,nombre,rol,"passwordHash",activo,"createdAt","updatedAt")
VALUES ('81e12e79-ab4d-4fe7-86e0-f360f010019d','admin1','Administrador 1','admin','9f465c1fa476f80c4fa5919726e42c3df267cd786df19856db78b2d9d0dc372f',true,'2026-04-15T13:10:49.026Z','2026-04-15T13:10:49.026Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Usuario" (id,username,nombre,rol,"passwordHash",activo,"createdAt","updatedAt")
VALUES ('5464c9c5-aaea-478d-8d09-e9af63f91c88','admin2','Administrador 2','admin','2fe9931e7c17416ed0adf03e5879f12c0723afe66680ec3c24aae02a930d5517',true,'2026-04-15T13:10:49.026Z','2026-04-15T13:10:49.026Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Usuario" (id,username,nombre,rol,"passwordHash",activo,"createdAt","updatedAt")
VALUES ('10d96e25-922c-4b0f-87d6-2d969a6a7fe4','admin3','Administrador 3','admin','216dbb1d41cd555df21b3bf7e70afb22284fdb37fca20e140eeb4e509651f764',true,'2026-04-15T13:10:49.026Z','2026-04-15T13:10:49.026Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Usuario" (id,username,nombre,rol,"passwordHash",activo,"createdAt","updatedAt")
VALUES ('513f2454-2d34-42bf-88bf-2dd990d2c7e1','admin4','Administrador 4','admin','7c48d8e2a6194a9dedcfedab7fc47668fdc450ef2e5df075edd36ec2efb991be',true,'2026-04-15T13:10:49.026Z','2026-04-15T13:10:49.026Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Usuario" (id,username,nombre,rol,"passwordHash",activo,"createdAt","updatedAt")
VALUES ('68f09a5d-144f-42f7-83cf-30ac7b7cc8af','admin5','Administrador 5','admin','d33098a9bfdd12b746ed1d1d485eb1820517079fe31dab1f8e25802f4ca65f11',true,'2026-04-15T13:10:49.026Z','2026-04-15T13:10:49.026Z')
ON CONFLICT (id) DO NOTHING;
