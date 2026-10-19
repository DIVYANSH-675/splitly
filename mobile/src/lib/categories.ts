export const expenseCategories = [
  {
    value: 'Food & drinks',
    label: 'Food & drinks',
    icon: 'restaurant-outline',
    bg: '#F5EADB',
    color: '#A17B4D',
  },
  { value: 'Transport', label: 'Travel', icon: 'car-outline', bg: '#E3EDF2', color: '#638697' },
  { value: 'Stay', label: 'Stay', icon: 'bed-outline', bg: '#EAE7F1', color: '#827397' },
  {
    value: 'Activities',
    label: 'Activities',
    icon: 'bicycle-outline',
    bg: '#E7EDD9',
    color: '#788A56',
  },
  {
    value: 'Groceries',
    label: 'Groceries',
    icon: 'basket-outline',
    bg: '#E7EDD9',
    color: '#788A56',
  },
  { value: 'Fuel', label: 'Fuel', icon: 'speedometer-outline', bg: '#E3EDF2', color: '#638697' },
  {
    value: 'Shopping',
    label: 'Shopping',
    icon: 'bag-handle-outline',
    bg: '#F3E6E7',
    color: '#9A6C71',
  },
  { value: 'Tickets', label: 'Tickets', icon: 'ticket-outline', bg: '#EAE7F1', color: '#827397' },
  { value: 'Rentals', label: 'Rentals', icon: 'key-outline', bg: '#F5EADB', color: '#A17B4D' },
  {
    value: 'Fees & tips',
    label: 'Fees & tips',
    icon: 'wallet-outline',
    bg: '#E8EDDF',
    color: '#78856C',
  },
  { value: 'Health', label: 'Health', icon: 'medkit-outline', bg: '#F3E6E7', color: '#9A6C71' },
  {
    value: 'Bills',
    label: 'Bills',
    icon: 'document-text-outline',
    bg: '#E3EDF2',
    color: '#638697',
  },
  { value: 'Other', label: 'Other', icon: 'receipt-outline', bg: '#E8EDDF', color: '#78856C' },
];
export const categoryInfo = (value: string) =>
  expenseCategories.find((category) => category.value === value) ||
  expenseCategories[expenseCategories.length - 1];
