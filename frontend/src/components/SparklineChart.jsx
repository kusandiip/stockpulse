import { LineChart, Line, ResponsiveContainer } from 'recharts'

export function SparklineChart({ data, positive }) {
  if (!data || data.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.map((v,i) => ({ v, i }))}>
        <Line type="monotone" dataKey="v" stroke={positive ? 'var(--green)' : 'var(--red)'} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
