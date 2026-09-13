import type { Category, NodePageResponse, NodesResponse } from '../../api/types'

/** `/n/{slug}.json` sends a few node fields that `Category` doesn't list yet. */
export interface NodeCategory extends Category {
  created_at?: string | null
  user_id?: number
}

export interface NodeResponse extends NodePageResponse {
  category: NodeCategory
}

/** One section entry of `/nodes.json` `grouped`. */
export type NodeGroup = NodesResponse['grouped'][string]
