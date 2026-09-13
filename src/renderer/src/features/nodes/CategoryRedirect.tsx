import { Navigate, useParams } from 'react-router'
import { useCategoryIndex } from '../../api/site'
import { Spinner } from '../../components/Spinner'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { paths } from '../../lib/routes'

/** `/c/:id` links (from forum URLs) resolve to the node route by slug. */
export function CategoryRedirect(): React.JSX.Element {
  const { categoryId } = useParams()
  const index = useCategoryIndex()
  if (!index) return <Spinner size={32} />
  const category = index.byId.get(Number(categoryId))
  if (!category) return <NotFoundPage />
  return <Navigate to={paths.node(category.slug)} replace />
}
