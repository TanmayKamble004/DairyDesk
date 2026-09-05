import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import StockStatusPage from '../components/StockStatusPage'
import { useToast } from '../components/Toast'
import {
  Badge,
  Card,
  EmptyRow,
  LoadFailed,
  Spinner,
  Td,
  Th,
} from '../components/ui'
import { expiryPhrase, formatDate, isExpiryStatus } from '../data/expiryStatus'

/**
 * What is behind the Fresh and Ageing stacks on the 3D shelf: every batch in
 * that status, soonest to expire first.
 *
 * Batches, not products. The Inventory page already rolls stock up per product;
 * the question this page answers is which *delivery* is about to turn, which is
 * the one a product-level total cannot answer.
 *
 * Expired stock has its own page rather than a third case here — it carries the
 * disposal flow, and the two read-only statuses should not have to know about it.
 */

const EMPTY_COPY = {
  fresh: {
    title: 'No fresh stock',
    detail: 'Everything on the shelf is either ageing or past its date.',
  },
  ageing: {
    title: 'Nothing ageing',
    detail: 'No batch is inside its ageing window yet.',
  },
}

export default function StockByStatus() {
  const { status } = useParams()
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    if (!isExpiryStatus(status)) return undefined
    return api
      .get('/stock-batches/', { params: { status, disposed: 'false' } })
      .then((res) => {
        // Soonest to expire first — the order the shelf is worked through.
        setRows([...res.data].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)))
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load ${status} stock. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    // A new status means a different list; blanking it stops the previous
    // one's rows sitting under the new page's heading while this fetch runs.
    setRows(null)
    load()
  }, [load])

  // Expired is its own route and anything else is a typed URL.
  if (status === 'expired') return <Navigate to="/inventory/expired" replace />
  if (!isExpiryStatus(status)) return <Navigate to="/" replace />

  return (
    <StockStatusPage status={status} rows={rows}>
      {failed && <LoadFailed what={`${status} stock`} onRetry={load} />}
      {!failed && !rows && <Spinner />}
      {!failed && rows && (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="text-right">Quantity</Th>
                <Th>Received</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-muted">
                  <Td className="font-medium text-ink">{row.product_name}</Td>
                  <Td className="capitalize">{row.product_category}</Td>
                  <Td className="text-right tabular-nums">
                    {row.quantity} {row.product_unit}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(row.received_date)}</Td>
                  {/* The date and how far off it is, together: "12 Sep" alone
                      makes every reader do the subtraction themselves. */}
                  <Td className="whitespace-nowrap">
                    {formatDate(row.expiry_date)}
                    <span className="ml-1.5 text-xs text-muted">
                      {expiryPhrase(row.expiry_date)}
                    </span>
                  </Td>
                  <Td>
                    <Badge value={row.expiry_status} />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={6}
                  title={EMPTY_COPY[status].title}
                  detail={EMPTY_COPY[status].detail}
                />
              )}
            </tbody>
          </table>
        </Card>
      )}
    </StockStatusPage>
  )
}
