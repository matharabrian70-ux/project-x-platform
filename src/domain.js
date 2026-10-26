function weightedPipeline(deals) {
  return deals.reduce((sum, deal) => sum + Number(deal.value || 0) * Number(deal.probability || 0), 0);
}

function profitAndMargin(income, expenses) {
  const revenue = income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const profit = revenue - expenseTotal;
  return {
    revenue,
    expenses: expenseTotal,
    profit,
    margin: revenue === 0 ? 0 : profit / revenue
  };
}

function deliveryProgress(milestones) {
  if (milestones.length === 0) return 0;
  return milestones.filter(milestone => milestone.status === 'complete').length / milestones.length;
}

function netProductRevenue(sales) {
  return sales.reduce((sum, sale) => sum + Number(sale.gross || 0) - Number(sale.refunds || 0), 0);
}

function weeklyCompletion(tasks) {
  if (tasks.length === 0) return 0;
  return tasks.filter(task => task.status === 'done').length / tasks.length;
}

function transition(current, next, allowed) {
  if (!allowed.includes(next)) {
    throw new Error(`Invalid transition: ${current} -> ${next}`);
  }
  return next;
}

module.exports = {
  weightedPipeline,
  profitAndMargin,
  deliveryProgress,
  netProductRevenue,
  weeklyCompletion,
  transition
};
