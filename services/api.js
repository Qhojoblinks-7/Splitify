const mockBillsByGroup = {
  "1": [
    { id: "1", title: "Dinner", amount: "45.00 GHC", receipientName: "Jane Smith", receipientEmail: "jane.smith@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Groceries", amount: "120.00 GHC", receipientName: "Mike Wilson", receipientEmail: "mikew@example.com", senderName: "John Doe", initialStatus: "request" },
    { id: "3", title: "Transport", amount: "30.00 GHC", receipientName: "Sarah Johnson", receipientEmail: "sarahj@example.com", senderName: "Jane Smith", initialStatus: "paid" },
    { id: "4", title: "Internet Bill", amount: "60.00 GHC", receipientName: "Sarah Johnson", receipientEmail: "sarahj@example.com", senderName: "John Doe", initialStatus: "pay" },
  ],
  "2": [
    { id: "1", title: "Flights", amount: "800.00 GHC", receipientName: "Emily Davis", receipientEmail: "emilyd@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Hotel", amount: "1200.00 GHC", receipientName: "Kofi Mensah", receipientEmail: "kofim@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "3", title: "Snacks", amount: "50.00 GHC", receipientName: "Fatima Al-Hassan", receipientEmail: "fatima@example.com", senderName: "Ama Aboagye", initialStatus: "request" },
    { id: "4", title: "Tour Guide", amount: "400.00 GHC", receipientName: "Kwame Asante", receipientEmail: "kwamea@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "5", title: "Souvenirs", amount: "75.00 GHC", receipientName: "John Doe", receipientEmail: "johnd@example.com", senderName: "Fatima Al-Hassan", initialStatus: "request" },
  ],
  "3": [
    { id: "1", title: "Lunch", amount: "35.00 GHC", receipientName: "Jane Smith", receipientEmail: "jane.smith@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Coffee", amount: "20.00 GHC", receipientName: "Kofi Mensah", receipientEmail: "kofim@example.com", senderName: "Emily Davis", initialStatus: "request" },
    { id: "3", title: "Pizza", amount: "55.00 GHC", receipientName: "Mike Wilson", receipientEmail: "mikew@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "4", title: "Taxi", amount: "40.00 GHC", receipientName: "Kwame Asante", receipientEmail: "kwamea@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "5", title: "Ice Cream", amount: "25.00 GHC", receipientName: "John Doe", receipientEmail: "johnd@example.com", senderName: "Kofi Mensah", initialStatus: "request" },
    { id: "6", title: "Cake", amount: "35.00 GHC", receipientName: "John Doe", receipientEmail: "johnd@example.com", senderName: "Fatima Al-Hassan", initialStatus: "request" },
    { id: "7", title: "Movie Tickets", amount: "50.00 GHC", receipientName: "Sarah Johnson", receipientEmail: "sarahj@example.com", senderName: "John Doe", initialStatus: "pay" },
  ],
  "4": [
    { id: "1", title: "Electricity", amount: "100.00 GHC", receipientName: "Jane Smith", receipientEmail: "jane.smith@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "2", title: "Internet", amount: "80.00 GHC", receipientName: "Sarah Johnson", receipientEmail: "sarahj@example.com", senderName: "Daniel Osei", initialStatus: "request" },
    { id: "3", title: "Water", amount: "60.00 GHC", receipientName: "Ama Aboagye", receipientEmail: "amaa@example.com", senderName: "John Doe", initialStatus: "pay" },
    { id: "4", title: "TV Subscription", amount: "50.00 GHC", receipientName: "Sarah Johnson", receipientEmail: "sarahj@example.com", senderName: "John Doe", initialStatus: "pay" },
  ],
};

export const fetchGroupBills = async (groupId) => {
  const response = await new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: mockBillsByGroup[groupId] || [], status: "ok" });
    }, 600);
  });
  return response.data;
};

export const fetchGroupBalances = async (groupId) => {
  const bills = await fetchGroupBills(groupId);
  return bills;
};
