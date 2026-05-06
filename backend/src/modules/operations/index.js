const operationsRoutes = require("./operations.routes");

const { IncidentService, IncidentError } = require("./incidents/incident.service");
const { EnforcementService, EnforcementError } = require("./enforcement/enforcement.service");
const { TransactionService, TransactionError } = require("./transactions/transaction.service");
const { ConsistencyAuditService } = require("./shared/consistency-audit.service");

const { Incident, INCIDENT_STATUSES } = require("./models/incident.model");
const { Enforcement, ENFORCEMENT_STATUSES } = require("./models/enforcement.model");
const { Transaction, TRANSACTION_STATUSES } = require("./models/transaction.model");

const { domainEventBus, DOMAIN_EVENTS } = require("./shared/domain-events");

module.exports = {
  operationsRoutes,
  IncidentService,
  IncidentError,
  EnforcementService,
  EnforcementError,
  TransactionService,
  TransactionError,
  ConsistencyAuditService,
  Incident,
  INCIDENT_STATUSES,
  Enforcement,
  ENFORCEMENT_STATUSES,
  Transaction,
  TRANSACTION_STATUSES,
  domainEventBus,
  DOMAIN_EVENTS,
};
