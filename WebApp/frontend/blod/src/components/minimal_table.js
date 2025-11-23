import { useMemo } from 'react';
import {
  MaterialReactTable,
  MRT_Table as MRTTable, // Usa la versione minimale
  useMaterialReactTable,
} from 'material-react-table';
import { mkConfig, generateCsv, download } from 'export-to-csv'; 
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Box, Button } from '@mui/material';
import { prepareDataForExport, sanitizeFilename } from '../utils';

const MinimalTable = ({ columns_value, data_table, filename }) => {
  if(!filename)
    filename = 'generated'

  const csvConfig = mkConfig({
    fieldSeparator: ',',
    decimalSeparator: '.',
    useKeysAsHeaders: true,
    filename: sanitizeFilename(filename)
  });

  const columns = useMemo(() => columns_value, [columns_value]);
  const data = data_table;

  const handleExportData = () => {
    const exportData = prepareDataForExport(data)
    const csv = generateCsv(csvConfig)(exportData);
    download(csvConfig)(csv);
  };

  const table = useMaterialReactTable({
    columns,
    data,
    enableKeyboardShortcuts: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enablePagination: true,
    enableSorting: true,

  initialState: {
    pagination: {
      pageSize: 10, 
      pageIndex: 0,
    },
    sorting: [
      {
        id: 'count',     
        desc: true,     
      },
    ],
    density: 'compact',
  },

    muiTableBodyRowProps: { hover: false },
    muiTableProps: {
      sx: {
        border: '1px solid rgba(81, 81, 81, .5)',
        caption: {
          captionSide: 'top',
        },
        overflow: 'auto', 
        whiteSpace: 'nowrap', 
      },
    },

    muiTableHeadCellProps: {
      sx: {
        color: '#000',
        fontWeight: 'bold',
        '& a': {
          color: '#000',
          textDecoration: 'none',
        },
        '& a:hover': {
          color: '#555',
        },
      },
    },
  });

  return (
    <Box
    sx={{
      width: '100%',
      overflowX: 'auto', // Scorrimento orizzontale per la tabella
    }}>
      {/* Toolbar personalizzata */}
      <Box
        sx={{
          display: 'flex',
          gap: '16px',
          padding: '8px',
          justifyContent: 'flex-end',
          width: '100%', 
          overflowX: 'auto', 
          flexWrap: 'wrap',
        }}
      >
      {/*  <Button
          onClick={handleExportData}
          startIcon={<FileDownloadIcon />}
        >
          Export All Data
        </Button> */}
      </Box> 
      
      {/* Tabella */}
      
      <MRTTable table={table} />
    </Box>
  );
};

export default MinimalTable;