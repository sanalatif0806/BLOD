import React from 'react';

function sanitizeFilename(filename) {
return filename
    .replace(/[\/\\:*?"<>|]/g, '_') 
    .replace(/\s+/g, '_') 
    .replace(/^\.+/, '') 
    .replace(/[^a-zA-Z0-9_\-.]/g, '')
    .substring(0, 255);
}

const prepareDataForExport = (data) => {
    return data.map((row) => {
      const newRow = {};
      Object.keys(row).forEach((key) => {
        const value = row[key];
        if (React.isValidElement(value)) {

          const anchor = value.props?.href || '';
          newRow[key] = anchor || ''; 
        } else if (typeof value === 'object' && value !== null) {

          newRow[key] = JSON.stringify(value);
        } else {
          newRow[key] = value; 
        }
      });
      return newRow;
    });
  };

function isValidUrl(value){
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
    return urlRegex.test(value);
}

function renderValueAsLink(value) {
    value = value.replace('#','')
    if (isValidUrl(value)) {
      return <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer">{value}</a>;
    }
    return value;
  }

const formatFairnessDataForBrushChart = (data) => {
  const fairSeries = [];
  const fSeries = [];
  const aSeries = [];
  const iSeries = [];
  const rSeries = [];

  data.forEach(entry => {
    const x = new Date(entry.analysis_date).getTime();
    const f = parseFloat(entry.FAIRness.f_score);
    const a = parseFloat(entry.FAIRness.a_score);
    const i = parseFloat(entry.FAIRness.i_score);
    const r = parseFloat(entry.FAIRness.r_score);
    const fair = parseFloat(entry.FAIRness.fair_score);

    fairSeries.push({ x, y: fair });
    fSeries.push({ x, y: f });
    aSeries.push({ x, y: a });
    iSeries.push({ x, y: i });
    rSeries.push({ x, y: r });
  });

  const min = fairSeries[0]?.x || null;
  const max = fairSeries[fairSeries.length - 1]?.x || null;

  return {
    fairSeries,
    fSeries,
    aSeries,
    iSeries,
    rSeries,
    min,
    max
  };
};


export {sanitizeFilename, prepareDataForExport, renderValueAsLink, formatFairnessDataForBrushChart}