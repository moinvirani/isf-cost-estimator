/**
 * Type Exports
 *
 * Import types from here:
 * import { Estimation, EstimationItem, ShopifyService } from '@/types'
 */

// Estimation types
export type {
  EstimationStatus,
  Estimation,
  NewEstimation,
  EstimationUpdate,
  EstimationWithItems,
} from './estimation'

// Item types
export type {
  ItemCategory,
  ShoeType,
  BagType,
  OtherLeatherType,
  MaterialType,
  ConditionRating,
  DetectedIssue,
  AIAnalysisResult,
  EstimationItem,
  NewEstimationItem,
  EstimationItemWithServices,
} from './item'

// Service types
export type {
  ShopifyService,
  PriceModifier,
  ItemService,
  NewItemService,
  AddServiceRequest,
} from './service'

// Training types
export type {
  TrainingExample,
  CorrectService,
  MatchingOrder,
  ZokoConversationForTraining,
  FetchZokoImagesResponse,
  SaveTrainingExampleRequest,
  NewTrainingExample,
} from './training'
