/**
 * Google Apps Script para crear gráficos automáticos en Google Sheets
 * 
 * CÓMO USAR:
 * 1. Abre Google Sheets → Extensiones → Apps Script
 * 2. Copia este código completo
 * 3. Guarda (Ctrl+S)
 * 4. Ejecuta la función: crearGraficos()
 * 5. Autoriza los permisos
 * 6. ¡Listo! Los gráficos se crearán automáticamente
 */

function crearGraficos() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Obtener datos
  const data = sheet.getDataRange().getValues();
  const numRows = data.length;
  
  console.log('📊 Creando gráficos...');
  console.log(`   Datos encontrados: ${numRows} filas`);
  
  if (numRows < 2) {
    alert('❌ No hay datos suficientes para crear gráficos');
    return;
  }
  
  // GRÁFICO 1: Visualizaciones Videos (línea)
  crearGraficoLinea(
    sheet, 
    'Visualizaciones de Videos',
    'A:A', // Fechas
    'C:C', // Videos
    0, 0   // Posición
  );
  
  // GRÁFICO 2: Todas las métricas (área)
  crearGraficoArea(
    sheet,
    'Todas las Métricas',
    'A:A',
    ['C:C', 'D:D', 'E:E', 'F:F', 'G:G'],
    ['Videos', 'Perfil', 'Likes', 'Comentarios', 'Compartidos'],
    0, 14  // Debajo del primer gráfico
  );
  
  // GRÁFICO 3: Comparativo de todas métricas (columnas)
  crearGraficoColumnas(
    sheet,
    'Comparativo de Métricas',
    'A:A',
    ['C:C', 'D:D', 'E:E', 'F:F', 'G:G'],
    0, 28
  );
  
  // GRÁFICO 4: Pie de totales por métrica
  crearGraficoPie(
    sheet,
    'Distribución de Totales',
    14, 0
  );
  
  alert('✅ ¡Gráficos creados exitosamente!');
}

/**
 * Crea un gráfico de líneas
 */
function crearGraficoLinea(sheet, titulo, rangoFechas, rangoValores, posRow, posCol) {
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(rangoFechas))
    .addRange(sheet.getRange(rangoValores))
    .setOption('title', titulo)
    .setOption('curveType', 'function')
    .setOption('lineWidth', 3)
    .setOption('pointSize', 6)
    .setOption('hAxis', {
      title: 'Fecha',
      slantedText: true,
      slantedTextAngle: 45
    })
    .setOption('vAxis', {
      title: 'Cantidad'
    })
    .setOption('legend', { position: 'bottom' })
    .setOption('animation', {
      duration: 1000,
      easing: 'out'
    })
    .setPosition(posRow + 2, posCol + 1, 0, 0)
    .setOption('width', 800)
    .setOption('height', 400)
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Crea un gráfico de área
 */
function crearGraficoArea(sheet, titulo, rangoFechas, rangoValores, labels, posRow, posCol) {
  const chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.AREA)
    .addRange(sheet.getRange(rangoFechas));
  
  // Agregar cada rango de valores
  rangoValores.forEach((rango) => {
    chartBuilder.addRange(sheet.getRange(rango));
  });
  
  const chart = chartBuilder
    .setOption('title', titulo)
    .setOption('isStacked', false)
    .setOption('areaOpacity', 0.3)
    .setOption('hAxis', {
      title: 'Fecha',
      slantedText: true,
      slantedTextAngle: 45
    })
    .setOption('vAxis', {
      title: 'Cantidad'
    })
    .setOption('legend', { position: 'bottom' })
    .setOption('animation', {
      duration: 1000,
      easing: 'out'
    })
    .setPosition(posRow + 2, posCol + 1, 0, 0)
    .setOption('width', 800)
    .setOption('height', 400)
    .setOption('colors', [
      '#FF6B6B', // Rojo videos
      '#4ECDC4', // Turquesa perfil
      '#45B7D1', // Azul likes
      '#FFA07A', // Salmón comentarios
      '#98D8C8'  // Verde menta compartidos
    ])
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Crea un gráfico de columnas
 */
function crearGraficoColumnas(sheet, titulo, rangoFechas, rangoValores, posRow, posCol) {
  const chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(rangoFechas));
  
  rangoValores.forEach((rango) => {
    chartBuilder.addRange(sheet.getRange(rango));
  });
  
  const chart = chartBuilder
    .setOption('title', titulo)
    .setOption('isStacked', false)
    .setOption('hAxis', {
      title: 'Fecha',
      slantedText: true,
      slantedTextAngle: 45
    })
    .setOption('vAxis', {
      title: 'Cantidad'
    })
    .setOption('legend', { position: 'bottom' })
    .setOption('animation', {
      duration: 1000,
      easing: 'out'
    })
    .setOption('bar', { groupWidth: '75%' })
    .setPosition(posRow + 2, posCol + 1, 0, 0)
    .setOption('width', 800)
    .setOption('height', 400)
    .setOption('colors', [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8'
    ])
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Crea un gráfico de pie con totales
 */
function crearGraficoPie(sheet, titulo, posRow, posCol) {
  // Crear rango con totales
  const dataRange = sheet.getRange('A1:G1');
  
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sheet.getRange('C:C'))
    .addRange(sheet.getRange('D:D'))
    .addRange(sheet.getRange('E:E'))
    .addRange(sheet.getRange('F:F'))
    .addRange(sheet.getRange('G:G'))
    .setOption('title', titulo)
    .setOption('pieHole', 0.4) // Donut chart
    .setOption('legend', { position: 'bottom' })
    .setOption('animation', {
      duration: 1000,
      easing: 'out'
    })
    .setPosition(posRow + 2, posCol + 1, 0, 0)
    .setOption('width', 500)
    .setOption('height', 400)
    .setOption('colors', [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8'
    ])
    .build();
  
  sheet.insertChart(chart);
}

/**
 * Eliminar todos los gráficos existentes (útil para actualizar)
 */
function eliminarGraficos() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const charts = sheet.getCharts();
  
  charts.forEach(chart => {
    sheet.removeChart(chart);
  });
  
  alert(`✅ ${charts.length} gráficos eliminados`);
}

/**
 * Actualizar gráficos (elimina y recrea)
 */
function actualizarGraficos() {
  eliminarGraficos();
  crearGraficos();
}

/**
 * Crear tabla de resumen con totales
 */
function crearResumen() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Obtener índices de columnas
  const headers = data[0];
  const colVideos = headers.indexOf('Visualizaciones Videos');
  const colPerfil = headers.indexOf('Visualizaciones Perfil');
  const colLikes = headers.indexOf('Me Gusta');
  const colComments = headers.indexOf('Comentarios');
  const colShares = headers.indexOf('Veces Compartido');
  
  // Calcular totales
  let totalVideos = 0, totalPerfil = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) { // Si hay fecha
      totalVideos += parseInt(data[i][colVideos] || 0);
      totalPerfil += parseInt(data[i][colPerfil] || 0);
      totalLikes += parseInt(data[i][colLikes] || 0);
      totalComments += parseInt(data[i][colComments] || 0);
      totalShares += parseInt(data[i][colShares] || 0);
    }
  }
  
  // Crear tabla de resumen en la esquina derecha
  const resumenCol = Math.max(...headers.map(h => h ? 1 : 0)) + 3;
  
  sheet.getRange(2, resumenCol).setValue('📊 RESUMEN');
  sheet.getRange(2, resumenCol).setFontWeight('bold').setFontSize(14).setBackground('#FFE5CC');
  
  sheet.getRange(4, resumenCol).setValue('Visualizaciones Videos:');
  sheet.getRange(4, resumenCol + 1).setValue(totalVideos);
  
  sheet.getRange(5, resumenCol).setValue('Visualizaciones Perfil:');
  sheet.getRange(5, resumenCol + 1).setValue(totalPerfil);
  
  sheet.getRange(6, resumenCol).setValue('Me Gusta:');
  sheet.getRange(6, resumenCol + 1).setValue(totalLikes);
  
  sheet.getRange(7, resumenCol).setValue('Comentarios:');
  sheet.getRange(7, resumenCol + 1).setValue(totalComments);
  
  sheet.getRange(8, resumenCol).setValue('Veces Compartido:');
  sheet.getRange(8, resumenCol + 1).setValue(totalShares);
  
  // Aplicar formato
  sheet.getRange(4, resumenCol, 5, 1).setFontWeight('bold');
  sheet.getRange(4, resumenCol + 1, 5, 1).setNumberFormat('#,##0').setFontWeight('bold').setFontSize(12);
  sheet.getRange(4, resumenCol, 5, 2).setBorder(true, true, true, true, true, true);
  
  alert('✅ Resumen creado');
}

/**
 * Formatear la tabla de datos
 */
function formatearTabla() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getDataRange();
  const numRows = range.getNumRows();
  
  // Encabezados
  const headerRange = sheet.getRange(1, 1, 1, range.getNumColumns());
  headerRange.setBackground('#1F4E78');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(12);
  
  // Filas alternadas
  for (let i = 2; i <= numRows; i++) {
    const rowRange = sheet.getRange(i, 1, 1, range.getNumColumns());
    if (i % 2 === 0) {
      rowRange.setBackground('#E7F0F7');
    } else {
      rowRange.setBackground('#FFFFFF');
    }
  }
  
  // Bordes
  range.setBorder(true, true, true, true, true, true);
  
  // Ancho de columnas
  sheet.setColumnWidth(1, 120); // Fecha
  sheet.setColumnWidth(2, 120); // Fecha ISO
  sheet.setColumnWidths(3, 7, 100); // Métricas
  
  alert('✅ Tabla formateada');
}

/**
 * Crear tabla dinámica (Pivot Table)
 */
function crearTabladinamica() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getActiveSheet();
  
  const dataRange = sourceSheet.getDataRange();
  
  // Crear nueva sheet para pivot table
  const pivotSheet = ss.insertSheet('Pivot Table');
  
  // Nota: Google Apps Script tiene limitaciones con pivot tables
  // Se recomienda crearlas manualmente desde UI: Data → Pivot Table
  alert('Para crear una tabla dinámica:\n1. Data → Pivot Table\n2. Selecciona las filas y valores\n3. Personaliza según sea necesario');
}
