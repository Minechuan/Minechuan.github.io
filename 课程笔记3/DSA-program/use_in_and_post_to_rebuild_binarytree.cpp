#include<iostream>
using namespace std;
//we assume that the tree don't have same value for two nodes
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) : val(x), left(NULL), right(NULL) {}
};

int in_array[10000];
int post_array[10000];

TreeNode* add_node(int in_left, int in_right, int post_left, int post_right) {

    if (post_left == post_right) {
        return new TreeNode(post_array[post_left]);
    }
    int root_value = post_array[post_right];
    TreeNode* root = new TreeNode(root_value);
    int cut_pos = 0;
    for (int i = in_left; i <= in_right; i++) {//find the location
        if (in_array[i] == root_value) {
            cut_pos = i;
            break;
        }
    }
    if (cut_pos > in_left) {
        root->left = add_node(in_left, cut_pos - 1, post_left, post_left + cut_pos - 1 - in_left);
    }
    if (cut_pos < in_right) {
        root->right = add_node(cut_pos + 1, in_right, post_right - (in_right - cut_pos), post_right - 1);
    }
    return root;
}
int ans_array[10000];
int order = 0;
void PreOrder(TreeNode* root) {
    if (root != NULL) {
        ans_array[order] = root->val;
        order++;
        PreOrder(root->left);
        PreOrder(root->right);
    }
}
int main() {// recursion find the root and divide the array
    int t;
    int cnt = 0;
    while (cin >> t) {
        in_array[cnt] = t;
        cnt++;
    }
    int num = cnt / 2;// the number of nodes
    for (int i = num; i < cnt; i++) {
        post_array[i - num] = in_array[i];
    }
    TreeNode* pointer = add_node(0,num-1,0,num-1);
    PreOrder(pointer);
    for (int i = 0; i < num; i++) {
        cout << ans_array[i] << ' ';
    }
    return 0;

}